<template>
  <div
    key="1"
    class="apos-login-form"
    v-if="phase === 'beforeSubmit'"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="context.name"
      :error="$t(error)"
    />

    <div class="apos-login-form__body">
      <form @submit.prevent="submit" data-apos-test="loginForm">
        <AposSchema
          :schema="schema"
          v-model="doc"
        />
        <a
          href="#"
          v-if="passwordResetEnabled"
          class="apos-login-form__link"
          @click.prevent="$emit('set-stage', 'forgotPassword')"
        >{{ $t('apostrophe:loginResetPassword') }}</a>
        <Component
          v-for="requirement in beforeSubmitRequirements"
          :key="requirement.name"
          :is="requirement.component"
          v-bind="getRequirementProps(requirement.name)"
          @done="requirementDone(requirement, $event)"
          @block="requirementBlock(requirement)"
        />
        <AposButton
          data-apos-test="loginSubmit"
          :busy="busy"
          :disabled="disabled"
          type="primary"
          label="apostrophe:login"
          button-type="submit"
          class="apos-login-form__submit"
          :modifiers="['gradient-on-hover', 'block']"
          @click="submit"
        />
      </form>
    </div>
  </div>
  <div
    key="2"
    class="apos-login-form"
    v-else-if="activeSoloRequirement"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="context.name"
      :error="$t(error)"
      :tiny="true"
    />
    <div class="apos-login-form__body">
      <Component
        v-if="!fetchingRequirementProps"
        v-bind="getRequirementProps(activeSoloRequirement.name)"
        :is="activeSoloRequirement.component"
        :success="activeSoloRequirement.success"
        :error="activeSoloRequirement.error"
        @done="requirementDone(activeSoloRequirement, $event)"
        @confirm="requirementConfirmed(activeSoloRequirement)"
      />
    </div>
  </div>
</template>

<script>
import AposLoginFormMixin from 'Modules/@apostrophecms/login/mixins/AposLoginFormMixin';

export default {
  name: 'AposLoginForm',
  mixins: [ AposLoginFormMixin ],
  emits: [ 'redirect', 'set-stage' ],
  data() {
    return {
      phase: 'beforeSubmit',
      busy: false,
      schema: [
        {
          name: 'username',
          label: 'Username',
          placeholder: 'Enter username',
          type: 'string',
          required: true
        },
        {
          name: 'password',
          label: 'Password',
          placeholder: 'Enter password',
          type: 'password',
          required: true
        }
      ],
      requirements: getRequirements(),
      requirementProps: {},
      fetchingRequirementProps: false
    };
  },
  computed: {
    disabled() {
      return this.doc.hasErrors ||
        !!this.beforeSubmitRequirements.find(requirement => !requirement.done);
    },
    beforeSubmitRequirements() {
      return this.requirements.filter(requirement => requirement.phase === 'beforeSubmit');
    },
    // The currently active requirement expecting a solo presentation.
    // Currently it only concerns `afterPasswordVerified` requirements.
    // beforeSubmit requirements are not presented solo.
    activeSoloRequirement() {
      return (this.phase === 'afterPasswordVerified') &&
        this.requirements.find(requirement =>
          (requirement.phase === 'afterPasswordVerified') && !requirement.done
        );
    }
  },
  watch: {
    context(newVal) {
      this.requirementProps = newVal.requirementProps;
    },
    async activeSoloRequirement(newVal) {
      if (
        (this.phase === 'afterPasswordVerified') &&
        (newVal?.phase === 'afterPasswordVerified') &&
        newVal.propsRequired &&
        !(newVal.success || newVal.error)
      ) {
        try {
          this.fetchingRequirementProps = true;
          const data = await apos.http.post(`${apos.login.action}/requirement-props`, {
            busy: true,
            body: {
              name: newVal.name,
              incompleteToken: this.incompleteToken
            }
          });
          this.requirementProps = {
            ...this.requirementProps,
            [newVal.name]: data
          };
        } catch (e) {
          this.error = e.message || 'apostrophe:loginErrorGeneric';
        } finally {
          this.fetchingRequirementProps = false;
        }
      } else {
        return null;
      }
    }
  },
  created() {
    this.requirementProps = this.context.requirementProps;
  },
  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      await this.invokeInitialLoginApi();
    },
    async invokeInitialLoginApi() {
      try {
        const response = await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            requirements: this.getInitialSubmitRequirementsData(),
            session: true
          }
        });
        if (response && response.incompleteToken) {
          this.incompleteToken = response.incompleteToken;
          this.phase = 'afterPasswordVerified';
        } else {
          this.redirectAfterLogin();
        }
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
        this.phase = 'beforeSubmit';
      } finally {
        this.busy = false;
      }
    },
    getInitialSubmitRequirementsData() {
      return Object.fromEntries(this.requirements
        .filter(r => r.phase !== 'afterPasswordVerified' || !r.done)
        .map(r => ([
          r.name,
          r.value
        ])));
    },
    async invokeFinalLoginApi() {
      try {
        await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            incompleteToken: this.incompleteToken,
            requirements: this.getFinalSubmitRequirementsData(),
            session: true
          }
        });
        this.redirectAfterLogin();
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
        this.phase = 'beforeSubmit';
      } finally {
        this.busy = false;
      }
    },
    getFinalSubmitRequirementsData() {
      return Object.fromEntries(this.requirements.filter(r => r.phase === 'afterPasswordVerified').map(r => ([
        r.name,
        r.value
      ])));
    },
    redirectAfterLogin() {
      // TODO handle situation where user should be sent somewhere other than homepage.
      // Redisplay homepage with editing interface
      this.$emit('redirect', `${apos.prefix}/`);
    },
    async requirementBlock(requirementBlock) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementBlock.name);
      requirement.done = false;
      requirement.value = undefined;
    },
    async requirementDone(requirementDone, value) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementDone.name);

      if (requirement.phase === 'beforeSubmit') {
        requirement.done = true;
        requirement.value = value;
        return;
      }

      requirement.error = null;

      try {
        await apos.http.post(`${apos.login.action}/requirement-verify`, {
          busy: true,
          body: {
            name: requirement.name,
            value,
            incompleteToken: this.incompleteToken
          }
        });

        requirement.success = true;
      } catch (err) {
        requirement.error = err;
      }

      // Avoids the need for a deep watch
      this.requirements = [ ...this.requirements ];

      if (requirement.success && !requirement.askForConfirmation) {
        requirement.done = true;

        if (!this.activeSoloRequirement) {
          await this.invokeFinalLoginApi();
        }
      }
    },

    async requirementConfirmed (requirementConfirmed) {
      const requirement = this.requirements
        .find(requirement => requirement.name === requirementConfirmed.name);

      requirement.done = true;

      if (!this.activeSoloRequirement) {
        await this.invokeFinalLoginApi();
      }
    },
    getRequirementProps(name) {
      return this.requirementProps[name] || {};
    }
  }
};

function getRequirements() {
  const requirements = Object.entries(apos.login.requirements).map(([ name, requirement ]) => {
    return {
      name,
      component: requirement.component || name,
      ...requirement,
      done: false,
      value: null,
      success: null,
      error: null
    };
  });
  return [
    ...requirements.filter(r => r.phase === 'beforeSubmit'),
    ...requirements.filter(r => r.phase === 'afterPasswordVerified')
  ];
}
</script>

<style lang="scss" scoped>
  .apos-login-form {
    form {
      position: relative;
      display: flex;
      flex-direction: column;
    }

    &__link {
      @include type-large;
      position: relative;
      // AposSchema adds $spacing-quadruple margin bottom
      top: -$spacing-triple;
      display: block;
      text-align: right;
      text-decoration: underline;
      text-underline-offset: 2px;

      &:hover,
      &:focus,
      &:active {
        color: var(--a-text-primary);
      }
    }
  }

  .apos-login-form__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>
