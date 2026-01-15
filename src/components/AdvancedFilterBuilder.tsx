'use client';

import { useState } from 'react';
import { Plus, X, Save, FolderOpen, Trash2 } from 'lucide-react';

// Filter types
export type FilterOperator = 'AND' | 'OR';
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '=' | '!=';

export interface FilterCondition {
  id: string;
  field: 'logFC' | 'padj' | 'gene_id' | 'regulation' | 'gene_name';
  operator: ComparisonOperator | 'contains' | 'not_contains' | 'in_list';
  value: string | number;
  displayValue?: string;
}

export interface FilterGroup {
  id: string;
  operator: FilterOperator; // How conditions within this group are combined
  conditions: FilterCondition[];
}

export interface AdvancedFilter {
  name?: string;
  groups: FilterGroup[];
  groupOperator: FilterOperator; // How groups are combined (AND/OR between groups)
}

interface AdvancedFilterBuilderProps {
  onApplyFilter: (filter: AdvancedFilter) => void;
  onClearFilter: () => void;
  savedFilters?: AdvancedFilter[];
  onSaveFilter?: (filter: AdvancedFilter, name: string) => void;
  onLoadFilter?: (filter: AdvancedFilter) => void;
  onDeleteFilter?: (name: string) => void;
}

const fieldOptions = [
  { value: 'logFC', label: 'Log2 Fold Change', type: 'number' },
  { value: 'padj', label: 'Adjusted P-value', type: 'number' },
  { value: 'gene_id', label: 'Gene ID', type: 'text' },
  { value: 'gene_name', label: 'Gene Name', type: 'text' },
  { value: 'regulation', label: 'Regulation', type: 'select' }
];

const numberOperators = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '!=' }
];

const textOperators = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'in_list', label: 'in list' }
];

export default function AdvancedFilterBuilder({
  onApplyFilter,
  onClearFilter,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter
}: AdvancedFilterBuilderProps) {
  const [filter, setFilter] = useState<AdvancedFilter>({
    groups: [{
      id: generateId(),
      operator: 'AND',
      conditions: [{
        id: generateId(),
        field: 'logFC',
        operator: '>',
        value: 0.58
      }]
    }],
    groupOperator: 'AND'
  });

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  const addCondition = (groupId: string) => {
    setFilter({
      ...filter,
      groups: filter.groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              conditions: [
                ...group.conditions,
                {
                  id: generateId(),
                  field: 'logFC',
                  operator: '>',
                  value: 0
                }
              ]
            }
          : group
      )
    });
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    setFilter({
      ...filter,
      groups: filter.groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.filter(c => c.id !== conditionId)
            }
          : group
      ).filter(group => group.conditions.length > 0) // Remove empty groups
    });
  };

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>
  ) => {
    setFilter({
      ...filter,
      groups: filter.groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map(condition =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition
              )
            }
          : group
      )
    });
  };

  const addGroup = () => {
    setFilter({
      ...filter,
      groups: [
        ...filter.groups,
        {
          id: generateId(),
          operator: 'AND',
          conditions: [{
            id: generateId(),
            field: 'logFC',
            operator: '>',
            value: 0
          }]
        }
      ]
    });
  };

  const removeGroup = (groupId: string) => {
    if (filter.groups.length > 1) {
      setFilter({
        ...filter,
        groups: filter.groups.filter(g => g.id !== groupId)
      });
    }
  };

  const toggleGroupOperator = (groupId: string) => {
    setFilter({
      ...filter,
      groups: filter.groups.map(group =>
        group.id === groupId
          ? { ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' }
          : group
      )
    });
  };

  const toggleGlobalOperator = () => {
    setFilter({
      ...filter,
      groupOperator: filter.groupOperator === 'AND' ? 'OR' : 'AND'
    });
  };

  const handleSaveFilter = () => {
    if (filterName && onSaveFilter) {
      onSaveFilter({ ...filter, name: filterName }, filterName);
      setShowSaveDialog(false);
      setFilterName('');
    }
  };

  const handleLoadFilter = (savedFilter: AdvancedFilter) => {
    setFilter(savedFilter);
    if (onLoadFilter) {
      onLoadFilter(savedFilter);
    }
    setShowLoadDialog(false);
  };

  const getOperatorsForField = (field: string) => {
    const fieldDef = fieldOptions.find(f => f.value === field);
    if (fieldDef?.type === 'number') {
      return numberOperators;
    }
    return textOperators;
  };

  const renderConditionValue = (
    groupId: string,
    condition: FilterCondition
  ) => {
    const fieldDef = fieldOptions.find(f => f.value === condition.field);

    if (condition.field === 'regulation') {
      return (
        <select
          value={condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1"
        >
          <option value="up">Up-regulated</option>
          <option value="down">Down-regulated</option>
        </select>
      );
    }

    if (condition.operator === 'in_list') {
      return (
        <textarea
          value={condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          placeholder="Enter gene IDs (one per line)"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 font-mono"
          rows={3}
        />
      );
    }

    return (
      <input
        type={fieldDef?.type === 'number' ? 'number' : 'text'}
        value={condition.value}
        onChange={(e) => updateCondition(groupId, condition.id, {
          value: fieldDef?.type === 'number' ? parseFloat(e.target.value) : e.target.value
        })}
        step={condition.field === 'padj' ? '0.001' : condition.field === 'logFC' ? '0.1' : undefined}
        placeholder={condition.field === 'gene_id' ? 'e.g., ENSG00000139618' : 'Enter value'}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1"
      />
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
        <div className="flex gap-2">
          {onSaveFilter && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save
            </button>
          )}
          {savedFilters.length > 0 && (
            <button
              onClick={() => setShowLoadDialog(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Load
            </button>
          )}
        </div>
      </div>

      {/* Filter Groups */}
      <div className="space-y-4">
        {filter.groups.map((group, groupIndex) => (
          <div key={group.id} className="border border-blue-200 bg-blue-50/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Group {groupIndex + 1}</span>
                <button
                  onClick={() => toggleGroupOperator(group.id)}
                  className={`px-2 py-1 text-xs font-semibold rounded ${
                    group.operator === 'AND'
                      ? 'bg-blue-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {group.operator}
                </button>
                <span className="text-xs text-gray-500">between conditions</span>
              </div>
              {filter.groups.length > 1 && (
                <button
                  onClick={() => removeGroup(group.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Remove group"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              {group.conditions.map((condition, conditionIndex) => (
                <div key={condition.id} className="flex items-start gap-2">
                  {conditionIndex > 0 && (
                    <div className="flex items-center justify-center w-12 text-xs font-semibold text-gray-600">
                      {group.operator}
                    </div>
                  )}

                  <div className="flex-1 flex items-start gap-2 bg-white p-2 rounded border border-gray-200">
                    {/* Field selector */}
                    <select
                      value={condition.field}
                      onChange={(e) => {
                        const newField = e.target.value as FilterCondition['field'];
                        const fieldDef = fieldOptions.find(f => f.value === newField);
                        const defaultOp = fieldDef?.type === 'number' ? '>' : '=';
                        updateCondition(group.id, condition.id, {
                          field: newField,
                          operator: defaultOp as any,
                          value: newField === 'regulation' ? 'up' : ''
                        });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[150px]"
                    >
                      {fieldOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Operator selector */}
                    {condition.field !== 'regulation' && (
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(group.id, condition.id, {
                          operator: e.target.value as any
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[120px]"
                      >
                        {getOperatorsForField(condition.field).map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    )}

                    {/* Value input */}
                    {renderConditionValue(group.id, condition)}

                    {/* Remove condition button */}
                    <button
                      onClick={() => removeCondition(group.id, condition.id)}
                      className="text-red-600 hover:text-red-800 p-2"
                      disabled={group.conditions.length === 1 && filter.groups.length === 1}
                      title="Remove condition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add condition button */}
            <button
              onClick={() => addCondition(group.id)}
              className="mt-2 inline-flex items-center px-3 py-1.5 text-sm text-blue-700 hover:text-blue-800"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add condition
            </button>

            {/* Group separator */}
            {groupIndex < filter.groups.length - 1 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <button
                  onClick={toggleGlobalOperator}
                  className={`w-full px-3 py-2 text-sm font-semibold rounded ${
                    filter.groupOperator === 'AND'
                      ? 'bg-blue-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {filter.groupOperator} (between groups)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add group button */}
      <button
        onClick={addGroup}
        className="mt-4 inline-flex items-center px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Add Filter Group
      </button>

      {/* Action buttons */}
      <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={onClearFilter}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Clear All
        </button>
        <button
          onClick={() => onApplyFilter(filter)}
          className="px-4 py-2 text-sm rounded-md text-white bg-brand-primary hover:bg-brand-primary/90"
        >
          Apply Filters
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Filter</h3>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Enter filter name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setFilterName('');
                }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFilter}
                disabled={!filterName}
                className="px-4 py-2 text-sm rounded-md text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Load Saved Filter</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedFilters.map((savedFilter, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">{savedFilter.name || `Filter ${idx + 1}`}</div>
                    <div className="text-xs text-gray-500">
                      {savedFilter.groups.length} group(s), {savedFilter.groups.reduce((acc, g) => acc + g.conditions.length, 0)} condition(s)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadFilter(savedFilter)}
                      className="px-3 py-1.5 text-sm text-brand-primary hover:bg-brand-primary/5 rounded"
                    >
                      Load
                    </button>
                    {onDeleteFilter && (
                      <button
                        onClick={() => {
                          if (savedFilter.name) {
                            onDeleteFilter(savedFilter.name);
                          }
                        }}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowLoadDialog(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
