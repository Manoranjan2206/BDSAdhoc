<template>
  <div>
    <button @click="$router.push('/')">Dashboard</button>
    <button @click="$router.push('/?mode=designer')">New Dashboard</button>
    <button @click="$router.push('/viewer')">Viewer</button>
    <button @click="$router.push('/designer')">Designer</button>

    <router-view />
  </div>
</template>
