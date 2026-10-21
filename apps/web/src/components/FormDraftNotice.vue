<script setup lang="ts">
defineProps<{ dirty: boolean; restored: boolean; error: string; blocked: boolean }>();
defineEmits<{ discard: [] }>();
</script>

<template>
  <div
    v-if="dirty || error"
    class="draft-notice"
  >
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else
      class="muted"
      role="status"
    >
      {{ restored ? '已恢复未提交草稿。' : '未提交草稿已暂存。' }}
      仅当前标签页可恢复，不会同步；关闭标签页后不保证保留。
    </p>
    <p
      v-if="blocked"
      class="form-error"
      role="alert"
    >
      原记录已变化或这条记录已经保存，请先核对列表。可复制输入后清除草稿，再重新编辑，不能直接覆盖。
    </p>
    <button
      class="text-button"
      type="button"
      @click="$emit('discard')"
    >
      清除草稿
    </button>
  </div>
</template>

<style scoped>
.draft-notice {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}

.draft-notice p {
  margin: 0 0 10px;
  line-height: 1.7;
}
</style>
