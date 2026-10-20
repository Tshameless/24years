package com.twentyfouryears.core.database

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.twentyfouryears.core.model.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28],manifest = Config.NONE)
class PregnancyRepositoryTest {
    private val context: Context get()=ApplicationProvider.getApplicationContext()
    private fun open(name: String)=Room.databaseBuilder(context,TwentyFourYearsDatabase::class.java,name).addMigrations(TwentyFourYearsDatabase.MIGRATION_1_2).build()
    private val profile=PregnancyProfile("p","测试","2027-01-01")

    @Test fun recordsSurviveClosingAndReopeningAndCheckupIsIdempotent() = runBlocking {
        val name="persistence-test";context.deleteDatabase(name)
        var db=open(name)
        try {
            var repo=LocalPregnancyRepository(db)
            repo.saveProfile(profile)
            val checkup=Checkup("c","p","复诊","2026-11-01",completed=true)
            val expense=LedgerEntry("checkup-c","p","实付",EntryKind.EXPENSE,12345,checkup.date,checkup.id)
            repo.saveCheckup(checkup,expense);repo.saveCheckup(checkup,expense)
            db.close();db=open(name);repo=LocalPregnancyRepository(db)
            val snapshot=repo.readSnapshot()
            assertEquals(profile,snapshot.profile);assertEquals(listOf(checkup),snapshot.checkups);assertEquals(listOf(expense),snapshot.ledger)
            repo.saveProfile(profile.copy(silent=true))
            assertTrue(repo.readSnapshot().profile!!.silent)
            assertEquals(1,repo.readSnapshot().ledger.size)
        } finally {db.close();context.deleteDatabase(name)}
    }
    @Test fun failedLinkedExpenseRollsBackCheckupAndFailedRestorePreservesData() = runBlocking {
        val name="transaction-test";context.deleteDatabase(name);val db=open(name)
        try {
            val repo=LocalPregnancyRepository(db);repo.saveProfile(profile)
            val checkup=Checkup("c","p","复诊","2026-11-01")
            try {repo.saveCheckup(checkup,LedgerEntry("e","p","错误",EntryKind.EXPENSE,-1,checkup.date));fail("Expected invalid amount")} catch(_: IllegalArgumentException) {}
            assertTrue(repo.readSnapshot().checkups.isEmpty())
            repo.saveCheckup(checkup)
            try {repo.replaceSnapshot(PregnancySnapshot(profile.copy(name="")));fail("Expected invalid profile")} catch(_: IllegalArgumentException) {}
            assertEquals(profile,repo.readSnapshot().profile);assertEquals(listOf(checkup),repo.readSnapshot().checkups)
            repo.replaceSnapshot(PregnancySnapshot());assertNull(repo.readSnapshot().profile)
            assertEquals(0,db.openHelper.readableDatabase.query("SELECT count(*) FROM pregnancy_records").use {it.moveToFirst();it.getInt(0)})
        } finally {db.close();context.deleteDatabase(name)}
    }
    @Test fun migrationPreservesVersionOneFamilyAndValidatesNewSchema() = runBlocking {
        val name="migration-test";context.deleteDatabase(name)
        context.openOrCreateDatabase(name,Context.MODE_PRIVATE,null).use {old ->
            old.execSQL("CREATE TABLE families (familyId TEXT NOT NULL PRIMARY KEY, familyMode TEXT NOT NULL, currentStage TEXT NOT NULL, careState TEXT NOT NULL)")
            old.execSQL("INSERT INTO families VALUES ('original','SINGLE','PREGNANCY','HEALTHY')")
            old.version=1
        }
        val db=open(name)
        try {
            val repo=LocalPregnancyRepository(db);repo.saveProfile(profile)
            assertEquals(profile,repo.readSnapshot().profile)
            db.openHelper.readableDatabase.query("SELECT familyId FROM families").use {assertTrue(it.moveToFirst());assertEquals("original",it.getString(0))}
        } finally {db.close();context.deleteDatabase(name)}
    }
}
