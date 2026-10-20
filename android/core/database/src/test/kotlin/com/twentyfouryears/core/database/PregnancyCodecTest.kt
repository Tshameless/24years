package com.twentyfouryears.core.database

import com.twentyfouryears.core.model.*
import org.junit.Assert.*
import org.junit.Test

class PregnancyCodecTest {
    private fun sample()=PregnancySnapshot(
        profile=PregnancyProfile("p","测试用户","2027-03-01",hospital="医院",medicalNotes="备注"),
        checkups=listOf(Checkup("c","p","复诊","2026-10-25",completed=true)),
        vitals=listOf(Vital("v","p",VitalKind.BLOOD_PRESSURE,120.0,80.0,1000)),
        ledger=listOf(LedgerEntry("e","p","复诊",EntryKind.EXPENSE,12345,"2026-10-25","c")),
        reminders=listOf(Reminder("r","p","遵医嘱","08:00")),
        contractions=listOf(Contraction("t","p",1000,2000,100,1000,false,1))
    )
    @Test fun backupRoundTripsEveryRecordAndExactMoney() {val expected=sample();assertEquals(expected,PregnancyCodec.import(PregnancyCodec.export(expected)))}
    @Test fun restoreDoesNotResumeTimerOnAnotherDevice() {
        val s=sample().copy(contractions=listOf(Contraction("t","p",1000,elapsedStart=100,bootCount=1)))
        val restored=PregnancyCodec.import(PregnancyCodec.export(s)).contractions.single()
        assertTrue(restored.interrupted);assertNotNull(restored.endedAt);assertNull(restored.durationMillis)
    }
    @Test fun rejectsForeignOwnerAndUnsupportedVersionBeforeWriting() {
        val json=PregnancyCodec.export(sample())
        assertThrows(IllegalArgumentException::class.java){PregnancyCodec.import(json.replace("\"pregnancyId\": \"p\"","\"pregnancyId\": \"other\""))}
        assertThrows(IllegalArgumentException::class.java){PregnancyCodec.import(json.replace("\"version\": 1","\"version\": 999"))}
    }
    @Test fun rejectsDuplicateRecordIds() {
        val s=sample();val duplicate=s.copy(checkups=s.checkups+s.checkups)
        assertThrows(IllegalArgumentException::class.java){PregnancyCodec.import(PregnancyCodec.export(duplicate))}
    }
}
