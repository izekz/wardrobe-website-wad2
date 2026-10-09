<script>
export default { props: { variant: { type: String, default: 'flower' } } }
</script>
<template>
  <svg viewBox="0 0 180 300" fill="none" aria-hidden="true" focusable="false" class="community-floral">
    <g v-if="variant === 'flower'">
      <path d="M90 98c13 69-37 120-19 195" stroke="#c0bea4" stroke-width="1.3" />
      <path d="M73 222c-32-5-39-20-45-32 25 5 40 11 45 32Z" fill="#b7c4a5" fill-opacity=".65" stroke="#a8b398" stroke-width=".8" />
      <path d="M72 247c32-9 45-30 51-47-25 9-43 23-51 47Z" fill="#bdc8a7" fill-opacity=".6" stroke="#a8b398" stroke-width=".8" />
      <path d="m72 246 40-35m-40 10-33-24" stroke="#a8b398" stroke-width=".8" />
      <g v-for="petal in 9" :key="petal" :transform="`rotate(${petal * 40} 90 89)`">
        <ellipse cx="90" cy="51" rx="10.5" ry="35" fill="#fff9ef" fill-opacity=".25" stroke="#eab8a7" stroke-width="1.3" />
        <path d="M90 85V23" stroke="#efd0be" stroke-width=".55" />
      </g>
      <circle cx="90" cy="89" r="12" fill="#f9e5ab" stroke="#e9d498" stroke-width=".8" />
      <path d="M132 174c4-20 17-31 31-34-1 17-13 33-31 34Z" fill="#f4c7cb" fill-opacity=".65" stroke="#edbec2" stroke-width=".8" />
      <path d="M17 264c5-17 17-25 33-26-5 15-16 25-33 26Z" fill="#ffe7b4" stroke="#ead69f" stroke-width=".8" />
    </g>
    <g v-else>
      <path d="M107 295c-6-81 4-168-48-246M105 250c27-42 25-111 39-180M100 194c-33-9-58-34-80-57" stroke="#d3b5a5" stroke-width="1.25" />
      <path d="M70 72C45 72 34 47 31 25c24 5 35 20 39 47Z" fill="#f8d3d4" fill-opacity=".8" stroke="#e9b3b8" stroke-width=".85" />
      <path d="M137 112c-12-36-2-66 16-89 7 35 4 64-16 89Z" fill="#fff9ed" stroke="#d4b1a6" stroke-width="1" />
      <path d="M86 112c-28-4-41-20-48-39 25 2 42 15 48 39Z" fill="#ffe8b7" fill-opacity=".85" stroke="#e7c895" stroke-width=".85" />
      <path d="M116 178c4-28 22-50 47-57-10 26-25 44-47 57Z" fill="#f7d0d3" fill-opacity=".7" stroke="#e9b3b8" stroke-width=".8" />
      <path d="M90 178c-26-5-47-20-57-37 27 2 47 15 57 37Z" fill="#bdc8aa" fill-opacity=".8" stroke="#a6b390" stroke-width=".8" />
      <path d="M107 241c15-16 33-22 52-20-14 15-29 22-52 20Z" fill="#b7c4a5" fill-opacity=".7" stroke="#a6b390" stroke-width=".8" />
      <path d="m40 38 26 30m80-31-7 61m-14 67 25-30m-101 17 31 20m37 61 32-10" stroke="#ccada0" stroke-width=".65" />
      <path d="M31 242c-10-20-7-35 2-51 9 19 11 35-2 51Z" fill="#f8d2d8" stroke="#e9bac5" stroke-width=".75" />
    </g>
  </svg>
</template>
