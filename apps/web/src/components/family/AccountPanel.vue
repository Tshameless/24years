<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';

const { cloud } = useFamily();
const { state, busy, expired, active } = cloud;
const register = shallowRef(true);
const credentials = reactive({ username: '', password: '', nickname: '' });

async function submit() {
  if (await cloud.authenticate(register.value && !expired.value, credentials)) {
    credentials.password = '';
  }
}

function logout() {
  if (window.confirm('退出后回到本机档案。已同步记录仍保留在账号中，未保存输入会丢失。')) {
    void cloud.logout();
  }
}
</script>

<template>
  <section class="panel account-panel">
    <div class="panel-heading">
      <h2>{{ state.user && !expired ? '我的同步账号' : '让陪伴，在两端相连' }}</h2>
      <span class="tag">{{ active ? '账号空间' : '可选开启' }}</span>
    </div>
    <template v-if="state.user && !expired">
      <p>
        {{ state.user.nickname }}
        <span class="muted">@{{ state.user.username }}</span>
      </p>
      <p class="muted">在另一台设备登录同一账号，就能继续查看和记录。</p>
      <button
        class="button button-secondary"
        :disabled="busy"
        @click="logout"
      >
        退出账号
      </button>
    </template>
    <form
      v-else
      class="form-grid"
      @submit.prevent="submit"
    >
      <p class="muted">本机记录无需账号。开启同步后，可以独立使用，也可以邀请伴侣加入。</p>
      <label class="field">
        同步账号
        <input
          v-model="credentials.username"
          required
          pattern="[a-zA-Z0-9_]{3,32}"
          minlength="3"
          maxlength="32"
          autocomplete="username"
          placeholder="3–32 位字母、数字或下划线"
        />
      </label>
      <label
        v-if="register && !expired"
        class="field"
      >
        成员称呼
        <input
          v-model="credentials.nickname"
          required
          maxlength="20"
          autocomplete="nickname"
          placeholder="伴侣会看到这个称呼"
        />
      </label>
      <label class="field">
        账号密码
        <input
          v-model="credentials.password"
          type="password"
          required
          minlength="10"
          maxlength="128"
          :autocomplete="register && !expired ? 'new-password' : 'current-password'"
          placeholder="至少 10 个字符"
        />
      </label>
      <p
        v-if="register && !expired"
        class="muted"
      >
        请妥善保存账号和密码，当前版本尚未提供密码找回。
      </p>
      <button
        class="button button-primary"
        :disabled="busy"
      >
        {{ register && !expired ? '注册并开启同步' : '登录同步账号' }}
      </button>
      <button
        v-if="!expired"
        type="button"
        class="text-button"
        :disabled="busy"
        @click="
          register = !register;
          cloud.clearError();
        "
      >
        {{ register ? '已有账号，去登录' : '还没有账号，去注册' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.account-panel .muted {
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
