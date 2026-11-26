<template>
  <div>
    <h2>{{ s.h }}</h2>
    <template v-for="(b, i) in s.b" :key="i">
      <p v-if="b.p">{{ b.p }}</p>
      <ul v-if="b.ul"><li v-for="x in b.ul" :key="x">{{ x }}</li></ul>
      <ol v-if="b.ol"><li v-for="x in b.ol" :key="x">{{ x }}</li></ol>
    </template>
  </div>
</template>
<script>
export default { props: { s: { type: Object, required: true } } };
</script>
