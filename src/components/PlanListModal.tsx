import { useState } from 'react';
import { useStore } from '../store';

interface Props {
  onClose(): void;
}

export function PlanListModal({ onClose }: Props) {
  const plans = useStore(s => s.plans);
  const activePlanId = useStore(s => s.activePlanId);
  const newPlan = useStore(s => s.newPlan);
  const deletePlan = useStore(s => s.deletePlan);
  const switchPlan = useStore(s => s.switchPlan);
  const renamePlan = useStore(s => s.renamePlan);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newPlanName, setNewPlanName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);

  const planList = Object.values(plans).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renamePlan(id, trimmed);
    }
    setRenamingId(null);
  }

  function handleDelete(id: string) {
    if (Object.keys(plans).length <= 1) return; // keep at least one
    deletePlan(id);
  }

  function handleSwitch(id: string) {
    switchPlan(id);
    onClose();
  }

  function handleCreate() {
    const name = newPlanName.trim() || 'Untitled Plan';
    newPlan(name);
    setNewPlanName('');
    setShowNewInput(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Plans</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {planList.map(plan => (
            <div
              key={plan.id}
              className={`flex items-center gap-2 px-5 py-3 group hover:bg-gray-50 ${
                plan.id === activePlanId ? 'bg-blue-50' : ''
              }`}
            >
              {/* Name / rename input */}
              {renamingId === plan.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(plan.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(plan.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 text-sm border border-blue-300 rounded px-2 py-0.5 outline-none"
                />
              ) : (
                <button
                  className="flex-1 text-left text-sm text-gray-800 truncate"
                  onClick={() => handleSwitch(plan.id)}
                  onDoubleClick={() => startRename(plan.id, plan.name)}
                  title="Click to switch • Double-click to rename"
                >
                  {plan.name}
                  {plan.id === activePlanId && (
                    <span className="ml-2 text-xs text-blue-500">(active)</span>
                  )}
                </button>
              )}

              {/* Action buttons (visible on hover) */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startRename(plan.id, plan.name)}
                  title="Rename"
                  className="text-xs text-gray-400 hover:text-gray-700 px-1"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  title="Delete"
                  disabled={planList.length <= 1}
                  className="text-xs text-gray-400 hover:text-red-500 px-1 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* New plan */}
        <div className="px-5 py-3 border-t border-gray-100">
          {showNewInput ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newPlanName}
                onChange={e => setNewPlanName(e.target.value)}
                placeholder="Plan name"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setShowNewInput(false);
                }}
                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
              />
              <button
                onClick={handleCreate}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewInput(false)}
                className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewInput(true)}
              className="w-full py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-200"
            >
              + New Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
