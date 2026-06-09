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
        <p class="page-subtitle">按学习类型查看已收藏的内容，支持测验与详情阅读。</p>
      </header>
      <div class="favorite-layout">
        <LearningTypeTreePanel
          :loading="fav.loading"
          :tree-nodes="fav.treeNodes"
          :selected-id="fav.selectedLearningTypeId"
          :leaf-selectable-only="false"
          @update:selected-id="onTreeSelect"
        />
        <FavoriteQuestionListPanel
          :loading="fav.loading"
          :selected-learning-type-id="fav.selectedLearningTypeId"
          :selected-learning-type-name="fav.selectedLearningTypeName"
          :message="fav.message"
          :rows="fav.filteredFavorites"
          :is-parent-node-selected="fav.isParentNodeSelected"
          :parent-hint="
            fav.FAVORITE_UI.parentHint(
              fav.descendantLeafNodes.length,
              fav.filteredFavorites.length,
            )
          "
          :parent-tree-table-rows="fav.parentTreeTableRows"
          :is-tree-branch-expanded="fav.isTreeBranchExpanded"
          :row-key-for-tree-row="fav.rowKeyForTreeRow"
          :row-title="fav.rowTitle"
          :row-type-label="fav.rowTypeLabel"
          @open="fav.openFavoriteRow($event)"
          @remove="fav.removeFavorite($event)"
          @test="fav.openQuestionTest"
          @toggle-branch="fav.toggleTreeBranch"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.favorite-page:not(.is-detail-view) {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.favorite-page.is-detail-view {
  display: grid;
  gap: 12px;
}

.page-hero {
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
  --fav-tree-indent: calc(var(--app-handout-font-size, 14px) * 1.15);
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.65);
}

/* 左侧学习类型树：字号随「学习内容字号」设置联动（与学习题库 / 错题本一致） */
.favorite-layout :deep(.type-panel .node-label) {
  font-size: calc(var(--app-handout-font-size, 14px) * 0.9);
}

.favorite-layout :deep(.type-panel .node-label-level-1) {
  font-size: calc(var(--app-handout-font-size, 14px) * 1.42);
}

.favorite-layout :deep(.type-panel .node-label-level-2) {
  font-size: calc(var(--app-handout-font-size, 14px) * 1.12);
}

.favorite-layout :deep(.type-panel .el-tree-node__content) {
  min-height: calc(var(--app-handout-font-size, 14px) * 2.35);
}
</style>
