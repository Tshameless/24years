package com.twentyfouryears.core.domain.finance

/**
 * Amounts are minor units (fen). [outflowActualPaid] is cash already after social insurance
 * reimbursement. Allowance and commercial payouts are inflows.
 */
data class BirthCostInput(
    val outflowActualPaid: Long,
    val maternityAllowance: Long,
    val commercialReimbursed: Long,
)

fun netBirthCost(input: BirthCostInput): Long =
    input.outflowActualPaid - input.maternityAllowance - input.commercialReimbursed
