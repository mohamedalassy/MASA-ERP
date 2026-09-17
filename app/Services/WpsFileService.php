<?php

namespace App\Services;

use App\Models\HrPayrollRun;
use Illuminate\Support\Facades\Storage;

/**
 * توليد ملف حماية الأجور (مدد) مع فحص مسبق.
 *
 * التكامل المباشر بالـ API محتاج اعتماد رسمي واتفاقيات — مش خطوة
 * أولى واقعية. لكن توليد الملف بالصيغة المطلوبة مع فحص مسبق
 * يمنع الرفض بيعطي ٩٠٪ من القيمة بـ١٠٪ من التعقيد.
 *
 * تأخّر أو غياب ملف الأجور = ٣٠٠٠ ريال لكل موظف شهريًا،
 * والمخالفة بتأثّر على تقييم نطاقات كذلك.
 */
class WpsFileService
{
    /**
     * فحص مسبق — يمنع الرفض قبل الرفع.
     *
     * @return array{is_valid:bool,errors:array,warnings:array}
     */
    public function validate(HrPayrollRun $run): array
    {
        $errors = [];
        $warnings = [];

        $run->load('lines.employee.activeContract');

        foreach ($run->lines as $line) {
            $employee = $line->employee;

            if (!$employee) {
                continue;
            }

            $name = $employee->employee_number;

            // الآيبان — أشيع سبب رفض
            if (empty($employee->iban)) {
                $errors[] = "[{$name}] لا يوجد رقم آيبان.";
            } elseif (!$this->isValidSaudiIban($employee->iban)) {
                $errors[] = "[{$name}] رقم الآيبان غير صحيح (يجب أن يبدأ بـ SA ويكون 24 خانة).";
            }

            // رقم الهوية أو الإقامة
            $identity = $employee->national_id ?: $employee->iqama_number;

            if (empty($identity)) {
                $errors[] = "[{$name}] لا يوجد رقم هوية أو إقامة.";
            } elseif (strlen(preg_replace('/\D/', '', $identity)) !== 10) {
                $errors[] = "[{$name}] رقم الهوية يجب أن يكون 10 أرقام.";
            }

            // رقم التأمينات
            if ($employee->gosi_subscribed && empty($employee->gosi_number)) {
                $warnings[] = "[{$name}] مشترك في التأمينات بدون رقم مسجّل.";
            }

            // تطابق الراتب مع عقد قوى — ده اللي بيجمّد مقيم
            $contract = $employee->activeContract;

            if (!$contract) {
                $errors[] = "[{$name}] لا يوجد عقد ساري.";
            } else {
                if (empty($contract->qiwa_authenticated_at)) {
                    $warnings[] = "[{$name}] العقد غير موثّق في قوى — الموظف لا يُحسب في نطاقات.";
                }

                $contractWage = round(
                    (float) $contract->basic_salary
                    + (float) $contract->housing_allowance
                    + (float) $contract->transport_allowance
                    + (float) $contract->phone_allowance
                    + (float) $contract->food_allowance
                    + (float) $contract->other_allowance,
                    2
                );

                $payrollWage = round(
                    (float) $line->basic_salary
                    + (float) $line->housing_allowance
                    + (float) $line->other_allowances,
                    2
                );

                if (abs($contractWage - $payrollWage) >= 0.01) {
                    $errors[] = sprintf(
                        '[%s] الراتب في المسيّر (%s) لا يطابق العقد (%s).',
                        $name,
                        number_format($payrollWage, 2),
                        number_format($contractWage, 2)
                    );
                }
            }

            if ((float) $line->net_salary <= 0) {
                $warnings[] = "[{$name}] صافي الراتب صفر أو أقل.";
            }
        }

        return [
            'is_valid' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings,
            'checked_count' => $run->lines->count(),
        ];
    }

    /** توليد ملف CSV بصيغة حماية الأجور. */
    public function generate(HrPayrollRun $run): array
    {
        $validation = $this->validate($run);

        $run->update([
            'wps_validation_status' => $validation['is_valid'] ? 'passed' : 'failed',
            'wps_validation_errors' => $validation['errors'],
        ]);

        if (!$validation['is_valid']) {
            return [
                'generated' => false,
                'validation' => $validation,
            ];
        }

        $run->load('lines.employee');

        $rows = [[
            'Employee ID',
            'Employee Name',
            'National ID / Iqama',
            'IBAN',
            'Basic Salary',
            'Housing Allowance',
            'Other Allowances',
            'Deductions',
            'Net Salary',
        ]];

        foreach ($run->lines as $line) {
            $employee = $line->employee;

            $deductions = round(
                (float) $line->absence_deduction
                + (float) $line->late_deduction
                + (float) $line->unpaid_leave_deduction
                + (float) $line->loan_deduction
                + (float) $line->other_deductions
                + (float) $line->gosi_employee,
                2
            );

            $rows[] = [
                $employee->employee_number,
                trim($employee->first_name . ' ' . $employee->last_name),
                $employee->national_id ?: $employee->iqama_number,
                $employee->iban,
                number_format((float) $line->basic_salary, 2, '.', ''),
                number_format((float) $line->housing_allowance, 2, '.', ''),
                number_format((float) $line->other_allowances, 2, '.', ''),
                number_format($deductions, 2, '.', ''),
                number_format((float) $line->net_salary, 2, '.', ''),
            ];
        }

        $csv = '';

        foreach ($rows as $row) {
            $csv .= implode(',', array_map(
                fn ($cell) => '"' . str_replace('"', '""', (string) $cell) . '"',
                $row
            )) . "\r\n";
        }

        $path = sprintf(
            'wps/%s-%d-%02d.csv',
            $run->run_number,
            $run->period_year,
            $run->period_month
        );

        Storage::disk('local')->put($path, "\xEF\xBB\xBF" . $csv);

        $run->update([
            'wps_file_path' => $path,
            'wps_generated_at' => now(),
        ]);

        return [
            'generated' => true,
            'path' => $path,
            'rows' => count($rows) - 1,
            'total_net' => round((float) $run->total_net, 2),
            'validation' => $validation,
        ];
    }

    /** آيبان سعودي: SA + 22 خانة = 24 إجمالًا. */
    private function isValidSaudiIban(string $iban): bool
    {
        $clean = strtoupper(preg_replace('/\s+/', '', $iban));

        return (bool) preg_match('/^SA\d{22}$/', $clean);
    }
}
