<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue';

const readings = [
  {
    title: '小池',
    author: '杨万里 · 古诗原文',
    text: '泉眼无声惜细流，树阴照水爱晴柔。小荷才露尖尖角，早有蜻蜓立上头。',
  },
  {
    title: '春晓',
    author: '孟浩然 · 古诗原文',
    text: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',
  },
  {
    title: '小种子的晚安',
    author: '24Years · 原创陪伴短文',
    text: '花园里有一颗小种子。它不着急长成大树，只把今天的一滴雨，轻轻收进怀里。风走过时说：慢慢来。月亮升起时说：我陪着你。小种子想，明天也许会伸出一片小叶子，也许只是安静地睡一觉。无论哪一种，都是很好的一天。晚安，小种子。晚安，我们的小小世界。',
  },
];
const selected = shallowRef(0);
const reading = computed(() => readings[selected.value]);
const source = shallowRef('');
const filename = shallowRef('');
const error = shallowRef('');
const player = useTemplateRef<HTMLAudioElement>('player');

function clearAudio() {
  player.value?.pause();

  if (source.value) {
    URL.revokeObjectURL(source.value);
  }

  source.value = '';
  filename.value = '';
}

function selectAudio(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  error.value = '';

  if (!file.type.startsWith('audio/') || file.size > 100 * 1024 * 1024) {
    error.value = '请选择不超过 100 MB 的音频文件。';

    return;
  }

  clearAudio();
  source.value = URL.createObjectURL(file);
  filename.value = file.name;
}

onBeforeUnmount(clearAudio);
</script>

<template>
  <section class="panel bonding-library">
    <div class="panel-heading">
      <h2>胎教与声音陪伴</h2>
      <span class="tag">随心陪伴</span>
    </div>
    <p class="muted">
      读诗、讲故事，或听喜欢的音乐。这是陪伴工具，不承诺胎教效果，也没有必须完成的时长。
    </p>
    <div class="library-grid">
      <article>
        <label class="field">
          选择阅读内容
          <select v-model="selected">
            <option
              v-for="(item, index) in readings"
              :key="item.title"
              :value="index"
            >
              {{ item.title }}
            </option>
          </select>
        </label>
        <h3 class="reading-title">{{ reading.title }}</h3>
        <p class="muted">{{ reading.author }}</p>
        <p class="reading-text">{{ reading.text }}</p>
      </article>
      <div>
        <h3>播放自己的音乐或家人录音</h3>
        <p class="muted">
          音频仅在本页播放，不上传、不保存到存档或 JSON 备份。离开或刷新后需重新选择，不自动播放。
        </p>
        <label class="field">
          选择本机音频
          <input
            type="file"
            accept="audio/*"
            @change="selectAudio"
          />
        </label>
        <template v-if="source">
          <p class="audio-name">{{ filename }}</p>
          <audio
            ref="player"
            :src="source"
            controls
            preload="metadata"
            aria-label="陪伴音频播放器"
            @error="error = '浏览器无法播放该音频，请更换文件。'"
          />
          <button
            class="text-button"
            @click="clearAudio"
          >
            移除音频
          </button>
        </template>
        <p
          v-if="error"
          class="form-error"
          role="alert"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bonding-library {
  margin-bottom: 22px;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
}

.muted {
  line-height: 1.9;
  font-size: 13px;
}

.reading-title {
  margin-top: 22px;
}

.reading-text {
  line-height: 2.2;
  font-family: var(--font-serif);
}

.audio-name {
  overflow-wrap: anywhere;
  margin-top: 16px;
}

audio {
  display: block;
  width: 100%;
  margin-bottom: 18px;
}

@media (max-width: 760px) {
  .library-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
