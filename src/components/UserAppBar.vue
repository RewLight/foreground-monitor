<!-- src/components/UserAppBar.vue -->
<template>
  <v-app-bar app color="primary">
    <template #prepend>
      <v-tooltip text="View on GitHub" location="bottom">
        <template #activator="{ props }">
          <v-btn
            icon
            href="https://github.com/RewLight/foreground-monitor/tree/web"
            target="_blank"
            rel="noopener"
            aria-label="GitHub"
            v-bind="props"
          >
            <v-icon>mdi-github</v-icon>
          </v-btn>
        </template>
      </v-tooltip>
    </template>

    <v-toolbar-title>
      <span>「</span>
      <v-select
        v-model="userStore.selectedUser"
        :items="usernames"
        variant="solo"
        density="compact"
        hide-details
        class="d-inline-block"
        style="width: 150px;"
        @update:model-value="onUserSelect"
      ></v-select>
      <span>」在干什么</span>
    </v-toolbar-title>

    <v-spacer></v-spacer>
    <!-- 可以在这里添加其他 AppBar 内容，如状态指示器 -->
  </v-app-bar>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();
const usernames = ref<string[]>([]);

const loadUsers = async () => {
  await userStore.loadUsersAndMachines();
  usernames.value = userStore.getUsernames();
};

const onUserSelect = (newUsername: string) => {
  if (newUsername) {
    router.push({ name: 'UserView', params: { username: newUsername } });
  }
};

onMounted(() => {
  loadUsers();
});

// 如果用户数据在别处更新，也同步更新下拉框选项
watch(() => userStore.userMachineMap, () => {
    usernames.value = userStore.getUsernames();
}, { deep: true });

</script>

<style scoped>
/* 尽量使用 Vuetify 类，但如有必要可添加少量样式 */
.v-select {
  font-size: inherit;
}
</style>
