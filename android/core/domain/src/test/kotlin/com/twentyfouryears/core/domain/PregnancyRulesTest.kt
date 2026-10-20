package com.twentyfouryears.core.domain

import com.twentyfouryears.core.model.*
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class PregnancyRulesTest {
    @Test fun gestationUsesFullDaysAcrossLeapDay() {
        val due=LocalDate.of(2024,10,1)
        val today=due.minusDays(280-85)
        assertEquals(Gestation(12,1,195),gestation(due,today))
        assertEquals(Gestation(40,0,0),gestation(due,due))
        assertEquals(-3L,gestation(due,due.plusDays(3)).daysUntilDue)
    }
    @Test fun moneyNeverUsesFloatingPointForCents() {
        assertEquals(29L,parseAmount("0.29"))
        assertEquals(12345678901L,parseAmount("123456789.01"))
        assertEquals("-0.29",money(-29))
        listOf("0","-1","1.001","NaN","1e3","").forEach {value -> assertThrows(IllegalArgumentException::class.java){parseAmount(value)}}
    }
    @Test fun netCashFlowKeepsNegativeBalancesAndDoesNotDeductInsuranceAgain() {
        val entries=listOf(LedgerEntry("a","p","实付",EntryKind.EXPENSE,45000,"2026-10-20"),LedgerEntry("b","p","到账",EntryKind.REIMBURSEMENT,10000,"2026-10-20"),LedgerEntry("c","p","津贴",EntryKind.ALLOWANCE,50000,"2026-10-20"))
        assertEquals(-15000L,netCashOutflow(entries))
    }
    @Test fun validatesCalendarDatesAndClockTimes() {
        assertEquals(LocalDate.of(2024,2,29),validDate("2024-02-29"))
        assertThrows(IllegalArgumentException::class.java){validDate("2025-02-29")}
        assertThrows(IllegalArgumentException::class.java){validTime("25:30")}
    }
    @Test fun vitalInputValidationDoesNotClassifyClinicalRisk() {
        validateVital(Vital("v","p",VitalKind.MOVEMENT,0.0,recordedAt=1))
        validateVital(Vital("v","p",VitalKind.BLOOD_PRESSURE,170.0,100.0,1))
        assertThrows(IllegalArgumentException::class.java){validateVital(Vital("v","p",VitalKind.WEIGHT,Double.NaN,recordedAt=1))}
        assertThrows(IllegalArgumentException::class.java){validateVital(Vital("v","p",VitalKind.MOVEMENT,1.5,recordedAt=1))}
        assertThrows(IllegalArgumentException::class.java){validateVital(Vital("v","p",VitalKind.BLOOD_PRESSURE,80.0,120.0,1))}
    }
}
