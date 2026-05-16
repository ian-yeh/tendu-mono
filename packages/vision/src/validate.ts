import type { ActionType, VisionDecision } from '@tendo/core';

const VALID_TYPES: ActionType[] = [
  'click', 'type', 'key', 'evaluate', 'scroll',
  'navigate', 'wait', 'done', 'fail', 'screenshot',
];

export function validateVisionDecision(obj: unknown): VisionDecision {
  if (!obj || typeof obj !== 'object')
    throw new Error('Response is not an object');

  const r = obj as any;

  if (typeof r.thought !== 'string')
    throw new Error('Missing or invalid "thought" field');
  if (!r.action || typeof r.action !== 'object')
    throw new Error('Missing or invalid "action" field');
  if (!VALID_TYPES.includes(r.action.type))
    throw new Error(`Unknown action type: "${r.action.type}"`);

  const { type } = r.action;

  if ((type === 'click' || type === 'type') && (typeof r.action.x !== 'number' || typeof r.action.y !== 'number'))
    throw new Error(`Action "${type}" requires numeric x and y`);
  if (type === 'type' && typeof r.action.text !== 'string')
    throw new Error('Action "type" requires a text field');
  if (type === 'key' && typeof r.action.key !== 'string')
    throw new Error('Action "key" requires a key field');
  if (type === 'evaluate' && typeof r.action.script !== 'string')
    throw new Error('Action "evaluate" requires a script field');
  if (type === 'navigate' && typeof r.action.url !== 'string')
    throw new Error('Action "navigate" requires a url field');
  if ((type === 'done' || type === 'fail') && typeof r.action.reason !== 'string')
    throw new Error(`Action "${type}" requires a reason field`);

  return r as VisionDecision;
}
