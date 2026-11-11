import { FilePlus } from 'lucide-react'
import { useDoc } from '../../lib/store'
import { EMPTY_SCRIPT, useActiveVideo, useVideos, type ScriptDoc } from '../../lib/data'
import { TemplateLibrary, type Template, type TemplateVar } from '../../ui/TemplateLibrary'
import { VideoBar, toast } from '../../ui/kit'

const CATEGORIES = ['Curiosity', 'Result first', 'Problem', 'Story', 'Contrarian', 'Question', 'Proof', 'Intro lines']

const VARIABLES: TemplateVar[] = [
  { key: 'topic', label: 'Topic', placeholder: 'sourdough baking' },
  { key: 'result', label: 'The result', placeholder: 'a loaf that actually rises' },
  { key: 'timeframe', label: 'Time span', placeholder: '30 days' },
  { key: 'audience', label: 'Who it is for', placeholder: 'first-time bakers' },
  { key: 'mistake', label: 'A common mistake', placeholder: 'over-proofing the dough' },
]

const t = (id: string, category: string, text: string): Template => ({ id, category, text })

const HOOKS: Template[] = [
  t('h01', 'Curiosity', 'I spent {timeframe} on {topic}. One thing surprised me more than the result.'),
  t('h02', 'Curiosity', 'There is a detail about {topic} that almost nobody mentions, and it changes how you should approach it.'),
  t('h03', 'Curiosity', 'By the end of this video you will know exactly why {mistake} keeps happening, and how to stop it.'),
  t('h04', 'Result first', 'This is {result}. Here is every step I took to get there, including the parts that failed.'),
  t('h05', 'Result first', '{result} in {timeframe}. No shortcuts. This is the whole process.'),
  t('h06', 'Result first', 'Here is the finished version. Now let me show you how {audience} can get the same result.'),
  t('h07', 'Problem', 'If you are one of the {audience} who finds {topic} harder than it should be, this is probably why.'),
  t('h08', 'Problem', 'Most {audience} give up on {topic} at the same point. Let us get you past it.'),
  t('h09', 'Problem', '{mistake} is costing you more than you think. Here is the fix.'),
  t('h10', 'Story', 'A year ago I could not get {result}. Then one small change to how I handle {topic} flipped everything.'),
  t('h11', 'Story', 'I almost quit {topic} last month. This is what happened instead.'),
  t('h12', 'Story', 'The first time I tried {topic}, it went badly. Here is what I do differently now.'),
  t('h13', 'Contrarian', 'Everyone warns {audience} about {mistake}. I think that advice misses the real problem.'),
  t('h14', 'Contrarian', 'Stop chasing {result}. Focus on this instead.'),
  t('h15', 'Contrarian', 'The popular advice about {topic} did not work for me. This did.'),
  t('h16', 'Question', 'What actually happens if you commit to {topic} for {timeframe}?'),
  t('h17', 'Question', 'Is {topic} still worth it for {audience}? I tested it so you do not have to.'),
  t('h18', 'Question', 'How much does {mistake} really matter? I ran the comparison.'),
  t('h19', 'Proof', 'I have done {topic} more times than I can count. These are the three things that matter.'),
  t('h20', 'Proof', 'I tracked my results with {topic} for {timeframe}. The numbers tell a clear story.'),
  t('h21', 'Intro lines', 'Here is the plan: first the basics of {topic}, then the mistake that trips up most {audience}, and finally how to reach {result}.'),
  t('h22', 'Intro lines', 'You do not need experience for this. If you are among the {audience}, everything here is built for where you are right now.'),
  t('h23', 'Intro lines', 'Quick note before we start: everything I use is listed in the description, so you can follow along.'),
]

export default function Hooks() {
  const { items: videos } = useVideos()
  const video = useActiveVideo()
  const [, setScript] = useDoc<ScriptDoc>('scripts', video?.id, EMPTY_SCRIPT)

  return (
    <>
      {videos.length > 0 && <VideoBar />}
      <TemplateLibrary
        storageKey="tpl:hooks"
        categories={CATEGORIES}
        builtin={HOOKS}
        variables={VARIABLES}
        action={
          video
            ? {
                label: 'Add to script',
                icon: <FilePlus size={15} />,
                run: (text) => {
                  setScript((prev) => ({ body: prev.body.trim() ? `${text}\n\n${prev.body}` : text }))
                  toast(`Added to the top of the script for "${video.title}"`)
                },
              }
            : undefined
        }
      />
    </>
  )
}
