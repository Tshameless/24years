package com.twentyfouryears.core.domain.finance

import org.junit.Assert.assertEquals
import org.junit.Test

class NetBirthCostTest {
    @Test
    fun subtractsInflowsFromActualPaid() {
        val net = netBirthCost(
            BirthCostInput(
                outflowActualPaid = 38_500_00,
                maternityAllowance = 24_000_00,
                commercialReimbursed = 0,
            ),
        )
        assertEquals(14_500_00, net)
    }
}
