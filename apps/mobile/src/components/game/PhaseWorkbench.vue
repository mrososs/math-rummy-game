<script setup lang="ts">
import { computed } from 'vue';
import {
  IonButton,
  IonChip,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
import type { SegmentCustomEvent, SelectCustomEvent } from '@ionic/core';
import { checkmarkCircle, closeCircleOutline } from 'ionicons/icons';
import {
  cardValue,
  operationSymbol,
  type EngineMeldInput,
  type GameCard,
  type MathOperation,
  type PhaseDefinition,
  type WildCard,
} from 'game-domain';

interface StagedMeldDetails extends EngineMeldInput {
  cards: readonly GameCard[];
}

const props = defineProps<{
  phase: PhaseDefinition;
  selectedCards: readonly GameCard[];
  stagedMelds: readonly StagedMeldDetails[];
  selectedOperation: MathOperation;
  validationMessage: string;
  canStage: boolean;
  canSubmit: boolean;
  phaseComplete: boolean;
}>();

const emit = defineEmits<{
  updateOperation: [operation: MathOperation];
  stage: [];
  unstage: [meldId: string];
  submit: [];
  setWildValue: [cardId: string, value: number];
}>();

const operationOptions = computed<MathOperation[]>(() => {
  if (props.phaseComplete) {
    return ['add', 'subtract', 'multiply', 'divide', 'double', 'run'];
  }
  const operations = props.phase.requirements.flatMap((requirement) => {
    if (requirement.kind === 'equation') return [...requirement.operations];
    if (requirement.kind === 'run') return ['run' as const];
    if (requirement.kind === 'double') return ['double' as const];
    return ['divide' as const];
  });
  return [...new Set(operations)];
});

const expression = computed(() => {
  if (!props.selectedCards.length) return 'Select cards from your hand';
  const values = props.selectedCards.map((card) => cardValue(card) ?? '★');
  return values.join(` ${operationSymbol(props.selectedOperation)} `);
});
const selectedWilds = computed(() =>
  props.selectedCards.filter((card): card is WildCard => card.kind === 'wild'),
);

function handleOperationChange(event: SegmentCustomEvent): void {
  const operation = event.detail.value;
  if (typeof operation === 'string') {
    emit('updateOperation', operation as MathOperation);
  }
}

function handleWildValue(cardId: string, event: SelectCustomEvent): void {
  if (typeof event.detail.value === 'number') {
    emit('setWildValue', cardId, event.detail.value);
  }
}
</script>

<template>
  <section
    class="workbench"
    aria-labelledby="workbench-title"
  >
    <header class="workbench__header">
      <div>
        <span>{{ props.phaseComplete ? 'HIT BUILDER' : 'PHASE BUILDER' }}</span>
        <h2 id="workbench-title">
          {{
            props.phaseComplete
              ? 'Match a table phase'
              : props.phase.shortTitle
          }}
        </h2>
      </div>
      <span
        v-if="!props.phaseComplete"
        class="workbench__progress"
      >
        {{ props.stagedMelds.length }}/{{ props.phase.requirements.length }}
        groups
      </span>
    </header>

    <div
      v-if="props.phaseComplete"
      class="workbench__complete"
    >
      <IonIcon :icon="checkmarkCircle" />
      <span>Select cards and an operation, then tap your phase or another player's compatible phase.</span>
    </div>

    <IonSegment
      class="operation-segment"
      :value="props.selectedOperation"
      :scrollable="operationOptions.length > 4"
      mode="ios"
      @ion-change="handleOperationChange"
    >
      <IonSegmentButton
        v-for="operation in operationOptions"
        :key="operation"
        :value="operation"
      >
        <IonLabel>{{ operationSymbol(operation) }}</IonLabel>
      </IonSegmentButton>
    </IonSegment>

    <div class="workbench__equation">
      <strong>{{ expression }}</strong>
      <small>{{
        props.phaseComplete
          ? 'Tap a completed group to validate this hit.'
          : props.validationMessage
      }}</small>
    </div>

    <div
      v-if="selectedWilds.length"
      class="wild-values"
    >
      <IonSelect
        v-for="wild in selectedWilds"
        :key="wild.id"
        :label="`Wild ${wild.id.slice(-3)} value`"
        label-placement="stacked"
        interface="popover"
        :value="wild.lockedValue"
        @ion-change="handleWildValue(wild.id, $event)"
      >
        <IonSelectOption
          v-for="value in 12"
          :key="value"
          :value="value"
        >
          {{ value }}
        </IonSelectOption>
      </IonSelect>
    </div>

    <template v-if="!props.phaseComplete">
      <div
        v-if="props.stagedMelds.length"
        class="staged-groups"
        aria-label="Staged phase groups"
      >
        <IonChip
          v-for="(meld, index) in props.stagedMelds"
          :key="meld.id"
          class="staged-group"
          @click="emit('unstage', meld.id)"
        >
          <span>G{{ index + 1 }}</span>
          <strong>
            {{
              meld.cards
                .map((card) => cardValue(card) ?? '★')
                .join(` ${operationSymbol(meld.operation)} `)
            }}
          </strong>
          <IonIcon :icon="closeCircleOutline" />
        </IonChip>
      </div>

      <div class="workbench__actions">
        <IonButton
          fill="outline"
          :disabled="!props.canStage"
          @click="emit('stage')"
        >
          Add group
        </IonButton>
        <IonButton
          class="primary-button"
          :disabled="!props.canSubmit"
          @click="emit('submit')"
        >
          Lay phase
        </IonButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.workbench {
  display: grid;
  gap: 0.7rem;
  padding: 0.85rem 0.95rem;
  border-top: 1px solid #cbd8e5;
  background: #eef3f8;
  color: var(--color-navy);
}

.workbench__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.workbench__header div {
  display: grid;
  gap: 0.08rem;
}

.workbench__header span,
.workbench__progress {
  color: var(--color-text-muted);
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.workbench__header h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.92rem;
}

.workbench__progress {
  padding-top: 0.2rem;
  color: var(--color-action);
}

.operation-segment {
  min-height: 2.45rem;
  border: 1px solid #cad7e3;
  border-radius: 0.7rem;
  background: #dce6ef;
  --background: #dce6ef;
}

.operation-segment ion-segment-button {
  min-height: 2.35rem;
  --color: #4e6880;
  --color-checked: var(--color-navy);
  --indicator-color: var(--color-turn);
}

.operation-segment ion-label {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 800;
}

.workbench__equation {
  display: flex;
  min-height: 3.2rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.65rem 0.8rem;
  border: 1px dashed #aebfd0;
  border-radius: 0.75rem;
  background: #f8fafc;
}

.workbench__equation strong {
  font-family: var(--font-display);
  font-size: 1rem;
}

.workbench__equation small {
  max-width: 12rem;
  color: var(--color-text-muted);
  font-size: 0.62rem;
  text-align: right;
}

.staged-groups {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
}

.wild-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.45rem;
}

.wild-values ion-select {
  min-height: 3rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid #cad7e3;
  border-radius: 0.7rem;
  background: #f8fafc;
  --highlight-color-focused: var(--color-turn);
}

.staged-group {
  flex: 0 0 auto;
  margin: 0;
  --background: #dcecdf;
  --color: #1c5d2b;
}

.staged-group span {
  font-size: 0.55rem;
  font-weight: 800;
}

.staged-group strong {
  margin-inline: 0.3rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
}

.workbench__actions {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 0.55rem;
}

.workbench__actions ion-button {
  min-height: 2.8rem;
  margin: 0;
  --border-radius: 0.7rem;
}

.workbench__complete {
  display: flex;
  min-height: 3rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.7rem;
  background: #dcecdf;
  color: #1c5d2b;
  font-size: 0.75rem;
  font-weight: 700;
}

.workbench__complete ion-icon {
  flex: 0 0 auto;
  font-size: 1.25rem;
}

@media (orientation: landscape) and (min-width: 40rem) {
  .workbench {
    align-content: start;
    border-top: 0;
    border-left: 1px solid #cbd8e5;
  }
}
</style>
