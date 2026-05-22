<script setup lang="ts">
import LearningTypeTreePanel from '@/components/LearningTypeTreePanel.vue'
import QuestionBankDetailPage from '@/views/learning/question-bank/components/QuestionBankDetailPage.vue'
import QuestionBankTestPage from '@/views/learning/question-bank/components/QuestionBankTestPage.vue'
import FavoriteDerivedMcqDetail from '@/views/learning/question-bank-favorite/components/FavoriteDerivedMcqDetail.vue'
import WrongQuestionDetailPage from './components/WrongQuestionDetailPage.vue'
import WrongQuestionTrashPanel from './components/WrongQuestionTrashPanel.vue'
import { useWrongBookPage } from './composables/useWrongBookPage'

const wb = useWrongBookPage()

const onTreeSelect = (id: number | null) => {
  wb.selectedLearningTypeId = id
}
</script>

<template>
  <section
    class="wrong-book-page"
    :class="{
      'is-detail-view':
        wb.showQuestionTest ||
        wb.viewingWrongRow ||
        wb.viewingBankQuestion ||
        wb.viewingDerivedPayload,
    }"
  >
    <QuestionBankTestPage
      v-if="wb.showQuestionTest"
      :learning-type-name="wb.selectedLearningTypeName"
      :learning-type-id="wb.selectedLearningTypeId"
      :questions="wb.wrongBookTestQuestionBanks"
      :preset-units="wb.wrongBookTestPresetUnits"
      :loading="wb.loading"
      :type-text-map="wb.typeTextMap"
      log-menu-origin="wrong-book"
      @back="wb.closeWrongBookTest"
    />
    <div v-else-if="wb.wrongBookDetailSurfaceOpen" class="wrong-book-detail-shell">
      <nav
        v-if="wb.wrongBookDetailNav"
        class="wrong-book-detail-nav"
        aria-label="错题上下题"
      >
        <el-button
          :disabled="!wb.wrongBookDetailNav.hasPrev"
          @click="wb.goWrongBookDetailPrev"
        >
          上一题
        </el-button>
        <span class="wrong-book-detail-nav-pos">
          第 {{ wb.wrongBookDetailNav.current }} / {{ wb.wrongBookDetailNav.total }} 题
        </span>
        <el-button
          :disabled="!wb.wrongBookDetailNav.hasNext"
          @click="wb.goWrongBookDetailNext"
        >
          下一题
        </el-button>
      </nav>
      <WrongQuestionDetailPage
        v-if="
          wb.viewingWrongRow &&
          wb.viewingWrongRow.questionType === 'mindmap-mcq' &&
          !wb.viewingDerivedPayload
        "
        :row="wb.viewingWrongRow"
        :learning-type-name="wb.getLearningTypeName(wb.viewingWrongRow.learningTypeId)"
        :source-question="wb.viewingBankQuestion"
        @back="wb.closeDetail"
      />
      <QuestionBankDetailPage
        v-else-if="wb.viewingBankQuestion"
        :question="wb.viewingBankQuestion"
        :type-label="wb.typeTextMap[wb.viewingBankQuestion.type ?? 'general']"
        :learning-type-name="wb.getLearningTypeName(wb.viewingBankQuestion.learningTypeId)"
        :hide-edit-button="true"
        @back="wb.closeDetail"
      />
      <FavoriteDerivedMcqDetail
        v-else-if="wb.viewingDerivedPayload && wb.viewingDerivedLearningTypeId != null"
        :payload="wb.viewingDerivedPayload"
        :learning-type-id="wb.viewingDerivedLearningTypeId"
        :learning-type-name="wb.getLearningTypeName(wb.viewingDerivedLearningTypeId)"
        @back="wb.closeDetail"
      />
    </div>
    <template v-else>
      <header class="page-hero">
        <span class="page-kicker">智学 07</span>
        <h2 class="page-title">错题本</h2>
        <p class="page-subtitle">
          自动收集题目测试中的错题；按学习类型（知识点）筛选，并基于艾宾浩斯记忆曲线自动安排下次复习。同一错题在<strong>连续三场</strong>题目测试中均满分后，会自动移出错题本（与手动删除相同，可在回收站恢复）；中途再错则重新计数。
        </p>
      </header>

      <div class="wrong-book-layout">
        <LearningTypeTreePanel
          :loading="wb.loading"
          :tree-nodes="wb.treeNodes"
          :selected-id="wb.selectedLearningTypeId"
          :leaf-selectable-only="true"
          @update:selected-id="onTreeSelect"
        />
        <section class="wrong-list-panel">
          <WrongQuestionTrashPanel
            v-if="wb.showTrashPanel"
            :loading="wb.loading"
            :rows="wb.trashRows"
            :selected-ids="wb.selectedTrashIds"
            :all-selected="wb.trashAllSelected"
            :indeterminate="wb.trashIndeterminate"
            :parse-title="wb.parseTrashRowTitle"
            :format-time="wb.formatTime"
            @back="wb.showTrashPanel = false"
            @toggle-all="wb.toggleTrashSelectAll"
            @toggle-row="wb.toggleTrashRowSelect"
            @restore-selected="wb.restoreSelectedFromTrash"
            @purge-selected="wb.purgeSelectedFromTrash"
            @clear-selected="wb.clearTrashSelection"
          />
          <template v-else>
          <div class="wrong-list-head">
            <p>
              当前知识点：<strong>{{ wb.selectedLearningTypeName }}</strong>
            </p>
            <div class="wrong-list-actions">
              <span class="backfill-days-label">回填范围</span>
              <el-input-number
                v-model="wb.backfillWithinDays"
                :min="1"
                :max="3650"
                :step="1"
                step-strictly
                controls-position="right"
              />
              <!-- <el-button :loading="wb.backfilling" @click="wb.previewBackfillFromLogs">
                回填预览
              </el-button> -->
              <el-button :loading="wb.backfilling" type="primary" @click="wb.backfillFromLogs">
                历史日志回填
              </el-button>
              <el-button type="danger" plain @click="wb.batchRemoveSelected">批量删除</el-button>
              <el-button plain @click="wb.showTrashPanel = true">恢复删除</el-button>
              <el-button plain @click="wb.clearSelection">清空勾选</el-button>
              <el-switch
                v-model="wb.onlyDue"
                inline-prompt
                active-text="仅看到期"
                inactive-text="全部"
              />
              <el-button
                type="primary"
                :disabled="
                  !wb.selectedLearningTypeId ||
                  (!wb.wrongBookTestQuestionBanks.length && !wb.wrongBookTestPresetUnits.length)
                "
                @click="wb.openWrongBookTest"
              >
                错题测验
              </el-button>
              <el-button :loading="wb.loading" @click="wb.loadData">刷新</el-button>
            </div>
          </div>
          <p v-if="wb.loading">加载中...</p>
          <p v-else-if="!wb.loading && wb.message">{{ wb.message }}</p>
          <p v-if="!wb.loading && !wb.selectedLearningTypeId">请先从左侧树中选择知识点。</p>
          <div v-else-if="!wb.loading && wb.filteredWrongRows.length === 0" class="wrong-empty-block">
            <p>当前条件下暂无错题。</p>
            <el-button v-if="wb.trashRows.length > 0" type="primary" plain @click="wb.showTrashPanel = true">
              打开回收站恢复删除
            </el-button>
          </div>
          <div v-else-if="!wb.loading" class="wrong-table">
            <div class="wrong-table-head">
              <span class="cell-check">
                <el-checkbox
                  :model-value="wb.pageAllSelected"
                  :indeterminate="wb.pageIndeterminate"
                  @change="wb.toggleSelectAllOnPage"
                />
              </span>
              <span>题目</span>
              <span>题型</span>
              <span>错误次数</span>
              <span>复习轮次</span>
              <span>下次复习</span>
              <span>操作</span>
            </div>
            <div class="wrong-table-body">
              <div
                v-for="row in wb.paginatedWrongRows"
                :key="row.id"
                class="wrong-table-row"
                role="button"
                tabindex="0"
                @click="wb.openRow(row)"
                @keydown.enter.prevent="wb.openRow(row)"
                @keydown.space.prevent="wb.openRow(row)"
              >
                <span class="cell-check" @click.stop>
                  <el-checkbox
                    :model-value="row.id != null && wb.selectedRowIds.includes(row.id)"
                    @change="wb.toggleRowSelect(row.id)"
                  />
                </span>
                <span class="cell-title" :title="wb.rowDisplayTitle(row)">
                  {{ wb.rowDisplayTitle(row) }}
                </span>
                <span>{{ wb.rowTypeLabel(row) }}</span>
                <span>{{ row.wrongCount }}</span>
                <span>{{ wb.rowReviewStageLabel(row.reviewStage) }}</span>
                <span class="cell-next-review">
                  <em>{{ wb.rowDueTag(row) }}</em> · {{ wb.formatTime(row.nextReviewAt) }}
                </span>
                <div class="cell-actions" @click.stop>
                  <el-button type="danger" link @click="wb.removeRow(row.id)">删除</el-button>
                </div>
              </div>
            </div>
            <div class="wrong-pagination-bar">
              <el-pagination
                v-model:current-page="wb.currentPage"
                v-model:page-size="wb.pageSize"
                :page-sizes="[10, 20, 30, 50]"
                :total="wb.filteredWrongRows.length"
                layout="total, sizes, prev, pager, next"
                background
                small
              />
            </div>
          </div>
          </template>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.wrong-book-page {
  display: grid;
  gap: 12px;
}

.wrong-book-page.is-detail-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  gap: 0;
}

.wrong-book-detail-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  gap: 10px;
}

.wrong-book-detail-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface);
  flex-shrink: 0;
}

.wrong-book-detail-nav-pos {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
  min-width: 7.5rem;
  text-align: center;
}

.wrong-book-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 12px;
  align-items: start;
  height: calc(100vh - 230px);
}

.wrong-list-panel {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface);
  padding: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.wrong-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.wrong-list-head p {
  margin: 0;
}

.wrong-list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.backfill-days-label {
  font-size: 12px;
  color: var(--app-text-muted);
}

.wrong-list-actions :deep(.el-button) {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
}

.wrong-list-actions :deep(.el-input-number) {
  width: 120px;
}

.wrong-list-actions :deep(.el-input-number .el-input__wrapper) {
  min-height: 32px;
  border-radius: 8px;
}

.wrong-list-actions :deep(.el-switch) {
  height: 32px;
  display: inline-flex;
  align-items: center;
}

.wrong-list-actions :deep(.el-switch__core) {
  min-width: 50px;
  height: 26px;
  border-radius: 13px;
}

.wrong-list-actions :deep(.el-switch__action) {
  width: 20px;
  height: 20px;
}

.wrong-list-actions :deep(.el-switch__label) {
  font-size: 12px;
}

.wrong-empty-block {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wrong-empty-block p {
  margin: 0;
}

.wrong-table {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: calc(100% - 96px);
  max-height: min(56vh, 480px);
}

.wrong-table-head,
.wrong-table-row {
  display: grid;
  grid-template-columns: 42px minmax(260px, 1.8fr) 110px 92px 112px minmax(230px, 1fr) 120px;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
}

.wrong-table-head {
  background: var(--app-surface-alt);
  font-weight: 600;
  border-bottom: 1px solid var(--app-border-soft);
}

.wrong-table-head {
  flex-shrink: 0;
}

.wrong-table-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.wrong-table-row {
  border-bottom: 1px solid var(--app-border-soft);
  cursor: pointer;
}

.wrong-table-row:last-child {
  border-bottom: none;
}

.wrong-table-row:hover {
  background: var(--app-surface-alt);
}

.cell-title {
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.45;
}

.cell-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cell-next-review {
  color: var(--app-text-muted);
  font-size: 13px;
}

.cell-next-review em {
  font-style: normal;
  color: var(--app-primary, #2563eb);
  font-weight: 600;
}

.cell-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.wrong-pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 10px 12px;
  border-top: 1px solid var(--app-border-soft);
  flex-shrink: 0;
  background: var(--app-surface);
}
</style>

