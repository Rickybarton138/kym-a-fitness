// PAR-Q — the physical-activity readiness screening every client answers when
// they join (both memberships) and can update from their profile afterwards.
//
// The seven questions are the standard readiness set in plain English. They
// carry stable keys, and every submission snapshots the text it was answered
// against (see parq_responses.questions) so an old, dated record still reads
// correctly after the wording is ever changed.
import { supabase } from './supabaseClient.js'

export const PARQ_QUESTIONS = [
  { key: 'heart', text: 'Has a doctor ever said you have a heart condition, or that you should only do physical activity recommended by a doctor?' },
  { key: 'chest_active', text: 'Do you feel pain in your chest when you do physical activity?' },
  { key: 'chest_rest', text: 'In the past month, have you had chest pain when you were not doing physical activity?' },
  { key: 'balance', text: 'Do you ever lose your balance because of dizziness, or do you ever lose consciousness?' },
  { key: 'joint', text: 'Do you have a bone or joint problem that could be made worse by a change in your physical activity?' },
  { key: 'meds', text: 'Is a doctor currently prescribing medication for your blood pressure or a heart condition?' },
  { key: 'pregnancy', text: 'Are you pregnant, or have you given birth in the last six months?' },
  { key: 'other', text: 'Do you know of any other reason why you should not do physical activity?' },
]

export const emptyAnswers = () => ({})

// Every question needs an explicit yes/no — a blank is not a "no".
export const parqComplete = (answers) => PARQ_QUESTIONS.every((q) => typeof answers?.[q.key]?.yes === 'boolean')

export const anyYes = (answers) => PARQ_QUESTIONS.some((q) => answers?.[q.key]?.yes === true)

export const flaggedQuestions = (row) => {
  const qs = row?.questions?.length ? row.questions : PARQ_QUESTIONS
  return qs.filter((q) => row?.answers?.[q.key]?.yes === true)
}

// A new row every time: the record is the dated history, never an overwrite.
export async function saveParq({ clientId, answers, medications, injuries, declaredName }) {
  const { error } = await supabase.from('parq_responses').insert({
    client_id: clientId,
    questions: PARQ_QUESTIONS.map((q) => ({ key: q.key, text: q.text })),
    answers,
    any_yes: anyYes(answers),
    medications: (medications || '').trim() || null,
    injuries: (injuries || '').trim() || null,
    declared_name: (declaredName || '').trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function latestParq(clientId) {
  const { data } = await supabase.from('parq_responses')
    .select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1)
  return (data && data[0]) || null
}
