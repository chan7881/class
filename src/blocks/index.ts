/**
 * 모든 블록 모듈을 여기서 한 번 import해 각자의 registerBlock(...) 부작용을 실행시킨다.
 * 새 블록 타입을 추가하면 파일을 만들고 이 목록에 한 줄만 추가하면 된다.
 */
import './TextBlock'
import './HeadingBlock'
import './ImageBlock'
import './VideoBlock'
import './CalloutBlock'
import './DividerBlock'
import './EmbedBlock'
import './ChartBlock'
import './PoeGroup'
import './questions'

export { getBlockDefinition, listBlockDefinitions, registerBlock } from './registry'
