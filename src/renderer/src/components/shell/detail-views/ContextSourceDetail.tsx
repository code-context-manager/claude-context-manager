import type { ContextSource } from '../../../../../core/types'
import { ContextType } from '../../../../../core/types'
import { useFileContent } from '../../../hooks/useFileContent'
import { FileOpenMenu } from '../../common/FileOpenMenu'
import { DetailHeader } from '../../common/DetailHeader'
import { DetailSection } from '../../common/DetailSection'
import { FilePreview } from '../../common/FilePreview'
import { McpServerDetail } from './McpServerDetail'

interface Props {
  source: ContextSource
}

const TYPE_LABELS: Record<ContextType, string> = {
  [ContextType.GlobalClaudeMd]: 'Global CLAUDE.md',
  [ContextType.ProjectClaudeMd]: 'Project CLAUDE.md',
  [ContextType.FolderClaudeMd]: 'Folder CLAUDE.md',
  [ContextType.Rule]: 'Rule',
  [ContextType.Skill]: 'Skill',
  [ContextType.Memory]: 'Memory',
  [ContextType.McpServer]: 'MCP Server',
  [ContextType.Settings]: 'Settings',
}

export function ContextSourceDetail({ source }: Props) {
  // MCP entries get a structured view — their backing config is usually a
  // multi-purpose blob (e.g. ~/.claude.json) where dumping the file content
  // would bury the actual server config in unrelated state. See vision.md.
  if (source.type === ContextType.McpServer) {
    return <McpServerDetail source={source} />
  }

  const { content, loading } = useFileContent(source.filePath)

  return (
    <div className="flex flex-col">
      <DetailHeader eyebrow={TYPE_LABELS[source.type]} />

      <DetailSection>
        <FileOpenMenu filePath={source.filePath} />
      </DetailSection>

      <DetailSection title="Preview" last>
        <FilePreview filePath={source.filePath} content={content} loading={loading} />
      </DetailSection>
    </div>
  )
}
