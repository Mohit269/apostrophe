<template>
  <AposModal
    :modal="modal" modal-title="Manage Page Tree"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Finished"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary"
        label="New Page"
        @click="openEditor(null)"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            @select-click="selectAll"
            @trash-click="trashClick"
            :options="{
              noSearch: true,
              noPager: true,
              hideSelectAll: !relationshipField
            }"
          />
        </template>
        <template #bodyMain>
          <AposTree
            :items="items"
            :headers="headers" :icons="icons"
            v-model="checked"
            :options="treeOptions"
            @update="update" @busy="setBusy"
            @edit="openEditor"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import klona from 'klona';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModalModifiedMixin, AposDocsManagerMixin ],
  emits: [ 'trash', 'search', 'safe-close' ],
  data() {
    return {
      moduleName: '@apostrophecms/page',
      modal: {
        active: false,
        type: 'slide',
        showModal: false
      },
      pages: [],
      pagesFlat: [],
      checked: [],
      options: {
        columns: [
          {
            label: 'Page Title',
            name: 'title'
          },
          {
            label: 'Published',
            name: 'published',
            labelIcon: 'circle',
            icon: 'circle'
          },
          {
            label: 'Edit',
            name: '_id',
            icon: 'pencil',
            iconOnly: true,
            type: 'button',
            action: 'edit'
          },
          {
            label: 'Link',
            name: '_url',
            icon: 'link',
            iconOnly: true,
            type: 'link'
          }
        ]
      },
      treeOptions: {
        bulkSelect: !!this.relationshipField,
        draggable: true
      }
    };
  },
  computed: {
    moduleOptions() {
      return apos.page;
    },
    items() {
      const items = [];
      if (!this.pages || !this.headers.length) {
        return [];
      }

      const pagesSet = klona(this.pages);

      pagesSet.forEach(page => {
        const data = {};

        this.headers.forEach(column => {
          data[column.name] = page[column.name];
          data._id = page._id;
          data.children = page.children;
          data.parked = page.parked;
        });
        items.push(data);
      });

      return items;
    },
    selectAllChoice() {
      const checkLen = this.checked.length;
      const rowLen = this.pagesFlat.length;

      return checkLen > 0 && checkLen !== rowLen ? {
        value: 'checked',
        indeterminate: true
      } : {
        value: 'checked'
      };
    }
  },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;

    await this.getPages();
  },
  methods: {
    async getPages () {
      this.pages = [];
      this.pagesFlat = [];
      const self = this;

      const pageTree = (await apos.http.get(
        '/api/v1/@apostrophecms/page', {
          busy: true,
          qs: {
            all: 1
          }
        }
      ));

      formatPage(pageTree);

      this.pages = [ pageTree ];

      function formatPage(page) {
        page.published = page.published ? 'Published' : 'Unpublished';
        self.pagesFlat.push({
          title: page.title,
          id: page._id,
          path: page.path,
          parked: page.parked
        });

        page.children = page._children;
        delete page._children;

        if (Array.isArray(page.children)) {
          page.children.forEach(formatPage);
        }
      }
    },
    async update(page) {
      const body = {
        _targetId: page.endContext,
        _position: page.endIndex
      };

      const route = `${this.moduleOptions.action}/${page.changedId}`;
      try {
        await apos.http.patch(route, {
          busy: true,
          body
        });
      } catch (error) {
        await apos.notify('An error occurred while updating the page tree.', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }

      await this.getPages();
    },
    setBusy(val) {
      apos.bus.$emit('busy', val);
    },
    toggleRowCheck(id) {
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(item => item !== id);
      } else {
        this.checked.push(id);
      }
    },
    selectAll(event) {
      if (!this.checked.length) {
        this.pagesFlat.forEach((row) => {
          this.toggleRowCheck(row.id);
        });
        return;
      }

      if (this.checked.length <= this.pagesFlat.length) {
        this.checked.forEach((id) => {
          this.toggleRowCheck(id);
        });
      }
    },
    trashClick() {
      // TODO: Trigger a confirmation modal and execute the deletion.
      this.$emit('trash', this.selected);
    },
    async openEditor(pageId) {
      if (await apos.modal.execute(this.moduleOptions.components.insertModal, {
        moduleName: this.moduleName,
        docId: pageId
      })) {
        await this.getPages();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
</style>