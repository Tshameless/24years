<script setup lang="ts">
import type { Component } from 'vue';
import {
  House,
  CalendarCheck,
  Wallet,
  Heart,
  Moon,
  Sun,
  Plus,
  ArrowRight,
  Check,
  X,
  Leaf,
  Download,
  ShieldCheck,
  Trash2,
} from '@lucide/vue';

withDefaults(defineProps<{ name: string; size?: number }>(), { size: 22 });

const icons: Record<string, Component> = {
  home: House,
  calendar: CalendarCheck,
  wallet: Wallet,
  heart: Heart,
  moon: Moon,
  sun: Sun,
  plus: Plus,
  arrow: ArrowRight,
  check: Check,
  close: X,
  leaf: Leaf,
  download: Download,
  shield: ShieldCheck,
  trash: Trash2,
};
</script>

<template>
  <component
    :is="icons[name] || icons.heart"
    :size="size"
    :stroke-width="1.6"
    aria-hidden="true"
  />
</template>
