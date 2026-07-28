/** 문항 6종(기본) 모듈을 import해 registerQuestion(...) 부작용을 실행시킨다. 과학 특화 6종은 7~8단계에서 여기 추가된다. */
import './Cloze'
import './Choice'
import './Short'
import './Combo'
import './Order'
import './Match'

export { getQuestionDefinition, isQuestionAnswered, listQuestionDefinitions, registerQuestion } from './registry'
