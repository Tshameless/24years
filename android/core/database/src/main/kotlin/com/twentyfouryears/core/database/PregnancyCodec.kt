package com.twentyfouryears.core.database

import com.twentyfouryears.core.model.*
import com.twentyfouryears.core.domain.*
import org.json.JSONArray
import org.json.JSONObject

/** Versioned local backup format. Contains personal health data; never send to logs. */
object PregnancyCodec {
    fun record(value: Any): PregnancyRecordEntity {
        val j = JSONObject()
        fun put(k: String, v: Any?) { j.put(k, v ?: JSONObject.NULL) }
        val id: String; val owner: String; val type: String
        when (value) {
            is Checkup -> {
                id=value.id; owner=value.pregnancyId; type="checkup"
                put("title",value.title); put("date",value.date); put("notes",value.notes); put("completed",value.completed)
            }
            is Vital -> {
                id=value.id; owner=value.pregnancyId; type="vital"
                put("kind",value.kind.name); put("value",value.value); put("secondary",value.secondary); put("recordedAt",value.recordedAt); put("notes",value.notes)
            }
            is LedgerEntry -> {
                id=value.id; owner=value.pregnancyId; type="entry"
                put("title",value.title); put("kind",value.kind.name); put("cents",value.cents); put("date",value.date); put("checkupId",value.checkupId)
            }
            is Reminder -> {
                id=value.id; owner=value.pregnancyId; type="reminder"
                put("title",value.title); put("time",value.time); put("enabled",value.enabled); put("completedDate",value.completedDate)
            }
            is Contraction -> {
                id=value.id; owner=value.pregnancyId; type="contraction"
                put("startedAt",value.startedAt); put("endedAt",value.endedAt); put("elapsedStart",value.elapsedStart); put("durationMillis",value.durationMillis); put("interrupted",value.interrupted); put("bootCount",value.bootCount)
            }
            else -> error("Unsupported record")
        }
        return PregnancyRecordEntity(id,owner,type,j.toString())
    }
    fun decode(r: PregnancyRecordEntity): Any {
        val j=JSONObject(r.payload)
        fun nullableString(k: String) = if(j.isNull(k)) null else j.getString(k)
        fun nullableLong(k: String) = if(j.isNull(k)) null else j.getLong(k)
        return when(r.type) {
            "checkup" -> Checkup(r.id,r.pregnancyId,j.getString("title"),j.getString("date"),j.getString("notes"),j.getBoolean("completed"))
            "vital" -> Vital(r.id,r.pregnancyId,VitalKind.valueOf(j.getString("kind")),j.getDouble("value"),if(j.isNull("secondary")) null else j.getDouble("secondary"),j.getLong("recordedAt"),j.getString("notes"))
            "entry" -> LedgerEntry(r.id,r.pregnancyId,j.getString("title"),EntryKind.valueOf(j.getString("kind")),j.getLong("cents"),j.getString("date"),nullableString("checkupId"))
            "reminder" -> Reminder(r.id,r.pregnancyId,j.getString("title"),j.getString("time"),j.getBoolean("enabled"),nullableString("completedDate"))
            "contraction" -> Contraction(r.id,r.pregnancyId,j.getLong("startedAt"),nullableLong("endedAt"),j.getLong("elapsedStart"),nullableLong("durationMillis"),j.getBoolean("interrupted"),j.optInt("bootCount",-1))
            else -> error("不支持的数据类型，请使用匹配版本的备份")
        }
    }
    fun assemble(profile: PregnancyProfile?, records: List<PregnancyRecordEntity>): PregnancySnapshot {
        val values=records.map(::decode)
        return PregnancySnapshot(profile,values.filterIsInstance<Checkup>().sortedBy { it.date },values.filterIsInstance<Vital>().sortedByDescending { it.recordedAt },values.filterIsInstance<LedgerEntry>().sortedByDescending { it.date },values.filterIsInstance<Reminder>().sortedBy { it.time },values.filterIsInstance<Contraction>().sortedByDescending { it.startedAt })
    }
    fun records(s: PregnancySnapshot): List<PregnancyRecordEntity> = (s.checkups+s.vitals+s.ledger+s.reminders+s.contractions).map(::record)
    fun export(s: PregnancySnapshot): String {
        val p=requireNotNull(s.profile) { "请先建立孕期档案" }
        val profile=JSONObject().put("id",p.id).put("name",p.name).put("dueDate",p.dueDate).put("silent",p.silent).put("hospital",p.hospital).put("contact",p.contact).put("medicalNotes",p.medicalNotes)
        val rows=JSONArray()
        records(s).forEach { r -> rows.put(JSONObject().put("id",r.id).put("pregnancyId",r.pregnancyId).put("type",r.type).put("data",JSONObject(r.payload))) }
        return JSONObject().put("format","24years-pregnancy").put("version",1).put("profile",profile).put("records",rows).toString(2)
    }
    fun import(text: String): PregnancySnapshot {
        val root=JSONObject(text)
        require(root.getString("format")=="24years-pregnancy" && root.getInt("version")==1) { "备份格式或版本不支持" }
        val p=root.getJSONObject("profile")
        val profile=PregnancyProfile(p.getString("id"),p.getString("name"),p.getString("dueDate"),p.getBoolean("silent"),p.getString("hospital"),p.getString("contact"),p.getString("medicalNotes"))
        validateProfile(profile)
        val rows=root.getJSONArray("records")
        require(rows.length()<=50000) { "备份记录过多" }
        val records=(0 until rows.length()).map {
            val r=rows.getJSONObject(it)
            require(r.getString("pregnancyId")==profile.id && r.getString("id").isNotBlank()) { "备份关联信息不完整" }
            PregnancyRecordEntity(r.getString("id"),profile.id,r.getString("type"),r.getJSONObject("data").toString())
        }
        require(records.map { it.id }.distinct().size==records.size) { "备份存在重复记录" }
        val result=assemble(profile,records)
        result.checkups.forEach { require(it.title.isNotBlank()); validDate(it.date) }
        result.vitals.forEach { validateVital(it); require(it.recordedAt > 0) }
        result.ledger.forEach { require(it.cents in 1..99999999999L && it.title.isNotBlank()); validDate(it.date) }
        result.reminders.forEach { require(it.title.isNotBlank()); validTime(it.time); it.completedDate?.let(::validDate) }
        result.contractions.forEach { require(it.startedAt>0 && (it.durationMillis?.let {duration -> duration>=0} ?: true)) }
        require(result.contractions.count { it.endedAt==null }<=1) { "备份包含多个进行中的计时" }
        return result.copy(contractions=result.contractions.map { if(it.endedAt==null) it.copy(endedAt=it.startedAt,interrupted=true,durationMillis=null) else it })
    }
}
