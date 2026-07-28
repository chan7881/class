import { SCIENCE_CONSTANTS } from '../data/constants'

export function Constants() {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-neutral-500">
          <th className="py-1">이름</th>
          <th className="py-1">기호</th>
          <th className="py-1">값</th>
          <th className="py-1">단위</th>
        </tr>
      </thead>
      <tbody>
        {SCIENCE_CONSTANTS.map((c) => (
          <tr key={c.symbol} className="border-b border-neutral-100">
            <td className="py-1.5">{c.nameKo}</td>
            <td className="py-1.5 font-mono">{c.symbol}</td>
            <td className="py-1.5">{c.value}</td>
            <td className="py-1.5 text-neutral-500">{c.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
