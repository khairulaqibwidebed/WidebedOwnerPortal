<template>
  <div class="sw" :class="{ moving, bleed: !disabled }" v-bind="disabled ? {} : handlers">
    <div class="sw-track" :class="{ anim: moving && !dragging }" :style="trackStyle">
      <div v-for="(id, i) in ids" :key="id" class="sw-p" :class="{ on: i === idx, far: moving && (i < lo || i > hi) }" :inert="i !== idx || undefined">
        <slot :name="id" />
      </div>
    </div>
  </div>
</template>
<script>
// Tab panels side by side. While you drag, the next (or previous) tab slides into view next to the current one, so you can see
// where you are going. At rest only the open tab is shown and there is no transform (so pop-ups inside it still cover the whole screen).
// Slots are named after the ids. Drag past about a thumb's width (or flick) to switch; otherwise it springs back.
import { swipeBlocked } from '@/lib/swipe.js';
export default {
  props: { modelValue: { type: String, required: true }, ids: { type: Array, required: true }, disabled: Boolean },
  emits: ['update:modelValue'],
  data() { return { pos: 0, dx: 0, moving: false, dragging: false, lo: 0, hi: 0 }; },
  computed: {
    idx() { return Math.max(0, this.ids.indexOf(this.modelValue)); },
    trackStyle() { return this.moving ? { transform: `translateX(calc(${-this.pos} * (100% + 28px) + ${this.dx}px))` } : null; },
    handlers() { return { onTouchstart: this.start, onTouchmove: this.move, onTouchend: this.end, onTouchcancel: this.cancel }; }
  },
  created() { this.pos = this.idx; this.t0 = { x: 0, y: 0, t: 0, ok: false }; },
  watch: {
    modelValue(n, o) {
      if (this.skip) { this.skip = false; return; }
      // Tapped a tab: slide from the old one to the new one
      const a = this.ids.indexOf(o), b = this.ids.indexOf(n);
      if (this.reduced() || a < 0 || b < 0) { this.pos = this.idx; return; }
      this.pos = a; this.dx = 0; this.lo = Math.min(a, b); this.hi = Math.max(a, b); this.moving = true;
      this.$nextTick(() => { this.$el.offsetWidth; this.pos = b; this.settle(); });
    }
  },
  methods: {
    reduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; },
    settle() { clearTimeout(this.tm); this.tm = setTimeout(() => { this.moving = false; this.pos = this.idx; this.dx = 0; }, 360); },
    start(e) { const p = e.touches[0]; this.t0 = { x: p.clientX, y: p.clientY, t: Date.now(), ok: e.touches.length === 1 && !swipeBlocked(e.target) }; this.dragging = false; },
    move(e) {
      if (!this.t0.ok) return;
      const p = e.touches[0], dx = p.clientX - this.t0.x, dy = p.clientY - this.t0.y;
      if (!this.dragging) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2 || this.reduced()) return;
        clearTimeout(this.tm); this.dragging = true; this.moving = true; this.pos = this.idx; this.lo = this.idx - 1; this.hi = this.idx + 1;
      }
      const to = this.idx + (dx < 0 ? 1 : -1), has = to >= 0 && to < this.ids.length;
      this.dx = has ? dx : dx * 0.22;      // nothing that way: stretch only a little
    },
    end(e) {
      if (!this.t0.ok) return; this.t0.ok = false;
      if (!this.dragging) { if (!this.reduced()) return; return this.flick(e); }
      const p = e.changedTouches[0], dx = p.clientX - this.t0.x, dy = p.clientY - this.t0.y;
      const d = dx < 0 ? 1 : -1, to = this.idx + d;
      const far = Math.abs(dx) > 70 || (Math.abs(dx) > 35 && Date.now() - this.t0.t < 250);
      this.dragging = false;
      if (far && Math.abs(dx) > Math.abs(dy) * 1.8 && to >= 0 && to < this.ids.length) {
        this.skip = true; this.pos = to; this.dx = 0; this.$emit('update:modelValue', this.ids[to]);
      } else this.dx = 0;
      this.settle();
    },
    cancel() { this.t0.ok = false; if (this.dragging) { this.dragging = false; this.dx = 0; this.settle(); } },
    flick(e) {   // reduced motion: no dragging, just switch on a clear swipe
      const p = e.changedTouches[0], dx = p.clientX - this.t0.x, dy = p.clientY - this.t0.y, to = this.idx + (dx < 0 ? 1 : -1);
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && to >= 0 && to < this.ids.length) this.$emit('update:modelValue', this.ids[to]);
    }
  },
  beforeUnmount() { clearTimeout(this.tm); }
};
</script>
