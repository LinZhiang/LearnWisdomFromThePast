<script setup lang="ts">
import LearningTypeTreePanel from '@/components/LearningTypeTreePanel.vue'
import QuestionBankDetailPage from '@/views/learning/question-bank/components/QuestionBankDetailPage.vue'
import QuestionBankTestPage from '@/views/learning/question-bank/components/QuestionBankTestPage.vue'
import FavoriteDerivedMcqDetail from './components/FavoriteDerivedMcqDetail.vue'
import FavoriteQuestionListPanel from './components/FavoriteQuestionListPanel.vue'
import { useQuestionBankFavoritePage } from './composables/useQuestionBankFavoritePage'

const fav = useQuestionBankFavoritePage()

const onTreeSelect = (id: number | null) => {
  fav.selectedLearningTypeId = id
}
</script>

<template>
  <section
    class="favorite-page"
    :class="{
      'is-detail-view': fav.viewingBankQuestion || fav.viewingDerivedPayload || fav.showQuestionTest,
    }"
  >
    <QuestionBankTestPage
      v-if="fav.showQuestionTest"
      :learning-type-name="fav.selectedLearningTypeName"
      :learning-type-id="fav.selectedLearningTypeId"
      :questions="fav.testQuestionBanks"
      :preset-units="fav.testPresetUnits"
      :loading="fav.loading"
      :type-text-map="fav.typeTextMap"
      log-menu-origin="favorite"
      @back="fav.closeQuestionTest"
    />
    <QuestionBankDetailPage
      v-else-if="fav.viewingBankQuestion"
      :question="fav.viewingBankQuestion"
      :type-label="fav.typeTextMap[fav.viewingBankQuestion.type ?? 'general']"
      :learning-type-name="fav.getLearningTypeName(fav.viewingBankQuestion.learningTypeId)"
      :hide-edit-button="true"
      @back="fav.closeDetail"
      @favorite-removed="fav.closeDetail"
    />
    <FavoriteDerivedMcqDetail
      v-else-if="fav.viewingDerivedPayload && fav.viewingDerivedLearningTypeId != null"
      :payload="fav.viewingDerivedPayload"
      :learning-type-id="fav.viewingDerivedLearningTypeId"
      :learning-type-name="fav.getLearningTypeName(fav.viewingDerivedLearningTypeId)"
      @back="fav.closeDetail"
    />
    <template v-else>
      <header class="page-hero">
        <span class="page-kicker">智学 03</span>
        <h2 class="page-title">题库收藏</h2>
        <p class="page-subtitle">按学习类型查看已收藏题目（含测验中 DeepSeek 生成的导图小题）。</p>
      </header>
      <div class="favorite-layout">
        <LearningTypeTreePanel
          :loading="fav.loading"
          :tree-nodes="fav.treeNodes"
          :selected-id="fav.selectedLearningTypeId"
          :leaf-selectable-only="true"
          @update:selected-id="onTreeSelect"
        />
        <FavoriteQuestionListPanel
          :loading="fav.loading"
          :selected-learning-type-id="fav.selectedLearningTypeId"
          :selected-learning-type-name="fav.selectedLearningTypeName"
          :message="fav.message"
          :rows="fav.filteredFavorites"
          :row-title="fav.rowTitle"
          :row-type-label="fav.rowTypeLabel"
          @open="fav.openFavoriteRow($event)"
          @remove="fav.removeFavorite($event)"
          @test="fav.openQuestionTest"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.favorite-page {
  display: grid;
  gap: 12px;
}

.favorite-page.is-detail-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  gap: 0;
}

.favorite-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 12px;
  align-items: start;
  height: calc(100vh - 230px);
}

.favorite-layout :deep(.type-panel) {
  overflow: auto;
}
</style>
