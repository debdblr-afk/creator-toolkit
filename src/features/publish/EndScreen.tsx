import { TemplateLibrary, type Template, type TemplateVar } from '../../ui/TemplateLibrary'

const CATEGORIES = ['End screen line', 'Pinned comment', 'Card callout', 'Subscribe ask']

const VARIABLES: TemplateVar[] = [
  { key: 'topic', label: 'Topic of this video', placeholder: 'knife skills' },
  { key: 'next video', label: 'The video to watch next', placeholder: 'my six-spice starter kit' },
  { key: 'question', label: 'A question for viewers', placeholder: 'Which cut do you find hardest?' },
  { key: 'link', label: 'A link to share', placeholder: 'https://example.com/recipe' },
]

const t = (id: string, category: string, text: string): Template => ({ id, category, text })

const TEMPLATES: Template[] = [
  t('e01', 'End screen line', 'If this helped with {topic}, the video on screen now covers {next video}. It picks up exactly where this one stops.'),
  t('e02', 'End screen line', 'That is everything on {topic}. The next step is {next video}, and it is right here.'),
  t('e03', 'End screen line', 'You have the basics of {topic} now. Watch {next video} next to avoid the mistake most people make after this.'),
  t('e04', 'End screen line', 'Before you go: {next video} is the one I would watch next. Click it now and I will see you there.'),
  t('e05', 'Pinned comment', 'Question for you: {question} I read every reply.'),
  t('e06', 'Pinned comment', 'Everything mentioned in the video is here: {link} What should I cover next?'),
  t('e07', 'Pinned comment', 'Corrections and extras: I will keep this comment updated with anything I missed about {topic}.'),
  t('e08', 'Pinned comment', 'If you try this, tell me how it went. {question}'),
  t('e09', 'Pinned comment', 'Watch next: {next video}. It goes deeper on the part of {topic} I had to rush through.'),
  t('e10', 'Card callout', 'I made a full video on that. It is in the card at the top of the screen now.'),
  t('e11', 'Card callout', 'If {topic} is new to you, start with the video linked above, then come back.'),
  t('e12', 'Card callout', 'There is a card on screen for {next video} if you want the long version.'),
  t('e13', 'Subscribe ask', 'If you want more on {topic}, subscribing is the easiest way to see the next one.'),
  t('e14', 'Subscribe ask', 'I post a new video on {topic} every week. Subscribe and you will not have to go looking for it.'),
  t('e15', 'Subscribe ask', 'New here? This channel is all about {topic}. Subscribe if that is your thing.'),
]

export default function EndScreen() {
  return <TemplateLibrary storageKey="tpl:endscreen" categories={CATEGORIES} builtin={TEMPLATES} variables={VARIABLES} />
}
