<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
class FinanceJournalLine extends Model {
 use HasFactory;
 protected $fillable=['journal_entry_id','account_id','cost_center_id','project_id','description','debit','credit'];
 protected $casts=['debit'=>'decimal:2','credit'=>'decimal:2'];
 public function journalEntry():BelongsTo{return $this->belongsTo(FinanceJournalEntry::class,'journal_entry_id');}
 public function account():BelongsTo{return $this->belongsTo(FinanceAccount::class,'account_id');}
 public function costCenter():BelongsTo{return $this->belongsTo(CostCenter::class,'cost_center_id');}
 public function project():BelongsTo{return $this->belongsTo(Project::class);}
 public function bankStatementLines():HasMany{return $this->hasMany(BankStatementLine::class,'finance_journal_line_id');}
}
