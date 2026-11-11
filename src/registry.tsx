// The 30 tools, in workflow order. Each one is code-split and loaded on demand.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import {
  AlignLeft,
  Binoculars,
  Calculator,
  CalendarDays,
  Captions,
  ChartColumn,
  Clapperboard,
  Clock,
  DatabaseBackup,
  FileText,
  Flame,
  Handshake,
  ImagePlus,
  Kanban,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  ListTree,
  ListVideo,
  Megaphone,
  MessageSquareQuote,
  Mic,
  MonitorPlay,
  Palette,
  ReceiptText,
  ScreenShare,
  Sparkles,
  Tags,
  Target,
  Type,
  type LucideIcon,
} from 'lucide-react'

export type GroupId = 'plan' | 'script' | 'produce' | 'publish' | 'grow'

export const GROUPS: { id: GroupId; name: string; tagline: string }[] = [
  { id: 'plan', name: 'Plan', tagline: 'Decide what to make, who it is for and when it ships.' },
  { id: 'script', name: 'Script', tagline: 'Turn the idea into words, structure and shots.' },
  { id: 'produce', name: 'Produce', tagline: 'Record, design and caption the video.' },
  { id: 'publish', name: 'Publish', tagline: 'Package the upload so it gets found and watched.' },
  { id: 'grow', name: 'Grow and earn', tagline: 'Track results, work with brands and get paid.' },
]

export interface Tool {
  n: number
  slug: string
  name: string
  blurb: string
  group: GroupId
  icon: LucideIcon
  view: LazyExoticComponent<ComponentType>
}

type Loader = () => Promise<{ default: ComponentType }>

const tool = (n: number, slug: string, name: string, blurb: string, group: GroupId, icon: LucideIcon, load: Loader): Tool => ({
  n,
  slug,
  name,
  blurb,
  group,
  icon,
  view: lazy(load),
})

export const TOOLS: Tool[] = [
  // Plan
  tool(1, 'ideas', 'Idea bank', 'Capture video ideas, rate them and promote the best into projects.', 'plan', Lightbulb, () => import('./features/plan/IdeaBank')),
  tool(2, 'calendar', 'Upload calendar', 'Plan publish dates a month at a time, with teasers shown next to uploads.', 'plan', CalendarDays, () => import('./features/plan/UploadCalendar')),
  tool(3, 'pipeline', 'Production kanban', 'Move each video from planned to published and see where work is stuck.', 'plan', Kanban, () => import('./features/plan/Pipeline')),
  tool(4, 'niche', 'Niche and audience worksheet', 'Pin down who the channel is for, what it promises and its content pillars.', 'plan', Target, () => import('./features/plan/Niche')),
  tool(5, 'series', 'Series and playlist planner', 'Group videos into series, order the episodes and track progress.', 'plan', ListVideo, () => import('./features/plan/SeriesPlanner')),
  tool(6, 'competitors', 'Competitor channel notes', 'Keep notes on similar channels: what works for them and the gaps you can fill.', 'plan', Binoculars, () => import('./features/plan/Competitors')),
  // Script
  tool(7, 'script', 'Script editor', 'Write the script with a live word count, runtime estimate and section breakdown.', 'script', FileText, () => import('./features/script/ScriptEditor')),
  tool(8, 'hooks', 'Hook and intro library', 'Fill-in-the-blank openers for the first fifteen seconds of a video.', 'script', Sparkles, () => import('./features/script/Hooks')),
  tool(9, 'titles', 'Title workshop', 'Generate title options from common formulas and check length before you commit.', 'script', Type, () => import('./features/script/Titles')),
  tool(10, 'outline', 'Video outline builder', 'Structure the video into timed sections, then turn it into a script skeleton.', 'script', ListTree, () => import('./features/script/Outline')),
  tool(11, 'shots', 'Shot and B-roll list', 'List every shot you need so nothing is missed on shoot day.', 'script', Clapperboard, () => import('./features/script/ShotList')),
  tool(12, 'teleprompter', 'Teleprompter', 'Scroll your script at reading speed, mirrored or full screen.', 'script', MonitorPlay, () => import('./features/script/Teleprompter')),
  // Produce
  tool(13, 'thumbnail', 'Thumbnail designer', 'Design a 1280 × 720 thumbnail with text, images and shapes, then export it.', 'produce', ImagePlus, () => import('./features/produce/ThumbnailDesigner')),
  tool(14, 'preview', 'Thumbnail A/B preview', 'Compare two thumbnails inside a mock video feed, at the sizes viewers see.', 'produce', LayoutGrid, () => import('./features/produce/ThumbnailPreview')),
  tool(15, 'recorder', 'Screen and webcam recorder', 'Record your screen or camera in the browser and download the file.', 'produce', ScreenShare, () => import('./features/produce/Recorder')),
  tool(16, 'voiceover', 'Voiceover recorder', 'Record narration takes with a level meter and keep the best one.', 'produce', Mic, () => import('./features/produce/Voiceover')),
  tool(17, 'subtitles', 'Subtitle editor', 'Create, fix and re-time captions, then export SRT or WebVTT.', 'produce', Captions, () => import('./features/produce/Subtitles')),
  tool(18, 'brand', 'Brand kit', "Keep your channel's colours, font, logo and voice in one place.", 'produce', Palette, () => import('./features/produce/BrandKit')),
  // Publish
  tool(19, 'description', 'Description builder', 'Assemble a description from reusable blocks, chapters and links.', 'publish', AlignLeft, () => import('./features/publish/Description')),
  tool(20, 'chapters', 'Chapter generator', "Build timestamps that follow YouTube's chapter rules and copy them out.", 'publish', Clock, () => import('./features/publish/Chapters')),
  tool(21, 'tags', 'Tag set manager', "Save reusable tag sets and build each video's tags inside the 500-character limit.", 'publish', Tags, () => import('./features/publish/TagSets')),
  tool(22, 'checklist', 'Pre-publish checklist', 'Run through every step before a video goes live.', 'publish', ListChecks, () => import('./features/publish/Checklist')),
  tool(23, 'endscreen', 'End screen and pinned comment templates', 'Ready-to-edit lines for outros, cards and the pinned comment.', 'publish', MessageSquareQuote, () => import('./features/publish/EndScreen')),
  tool(24, 'promo', 'Community post and Shorts teaser planner', 'Plan the posts and teasers that launch each video.', 'publish', Megaphone, () => import('./features/publish/Promo')),
  // Grow and earn
  tool(25, 'analytics', 'Analytics tracker', "Log each video's results and watch the channel's trend.", 'grow', ChartColumn, () => import('./features/grow/Analytics')),
  tool(26, 'calculators', 'CTR, retention and RPM calculators', 'Quick maths for click-through rate, retention, RPM and watch hours.', 'grow', Calculator, () => import('./features/grow/Calculators')),
  tool(27, 'deals', 'Sponsorship CRM', 'Track brand deals from first contact to payment.', 'grow', Handshake, () => import('./features/grow/Deals')),
  tool(28, 'invoice', 'Rate card and invoice generator', 'Work out what to charge and produce a printable invoice.', 'grow', ReceiptText, () => import('./features/grow/Invoice')),
  tool(29, 'goals', 'Goals and upload streaks', 'Set targets, track progress and keep your upload streak alive.', 'grow', Flame, () => import('./features/grow/Goals')),
  tool(30, 'backup', 'Backup and restore', 'Export everything to a file, restore it, or start fresh.', 'grow', DatabaseBackup, () => import('./features/grow/Backup')),
]
