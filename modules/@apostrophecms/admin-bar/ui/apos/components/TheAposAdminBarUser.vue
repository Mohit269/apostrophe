<template>
  <AposContextMenu
    class="apos-admin-user"
    :button="button"
    :menu="menu"
    menu-placement="bottom-end"
    @item-clicked="emitEvent"
  >
    <template #prebutton>
      <AposAvatar
        class="apos-admin-user__avatar"
        :user="user"
      />
    </template>
  </AposContextMenu>
</template>

<script>

export default {
  name: 'TheAposAdminBarUser',
  data() {
    return {
      menu: [
        {
          label: 'apostrophe:logOut',
          name: 'logOut',
          action: 'user-logout'
        }
      ]
    };
  },
  computed: {
    button() {
      return {
        label: {
          key: this.user.title || '',
          localize: false
        },
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    },
    user() {
      return window.apos.login.user;
    }
  },
  methods: {
    emitEvent(e) {
      if (e === 'user-logout') {
        apos.bus.$emit('admin-menu-click', '@apostrophecms/login-logout');
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-user.apos-context-menu {
  display: inline-flex;
  align-items: center;

  ::v-deep .apos-button {
    @include type-base;
    color: var(--a-text-primary);
  }

  ::v-deep .apos-context-menu__popup {
    right: 0;
    transform: translatex(10px);
  }
}

.apos-admin-user__avatar {
  margin-right: 8px;
}
</style>
