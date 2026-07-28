/** 사진·그림 문항 에디터에 붙이는 개인정보 경고 (docs/PLAN.md 「중앙 배포에 따른 필수 대응」 2번). */
export function MediaPrivacyNotice() {
  return (
    <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
      ⚠️ 학생이 올린 사진·그림은 이 서비스를 운영하는 계정의 Google Drive에 저장돼요. 얼굴이나 개인정보가 찍히지 않도록 학생에게 미리 안내하세요.
    </p>
  )
}
