package com.twentyfouryears.core.sync

/** Offline-first placeholder. 0.1.0 may run fully local. */
interface SyncQueue {
    suspend fun enqueue(entityType: String, entityId: String)
}
