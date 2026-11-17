import { S } from '../strings/en'
import { Page } from '../components/ui'

/** The reference table behind the colour labels. */
export default function Ranges() {
  const R = S.ranges
  return (
    <Page title={R.title} back>
      <p className="sub">{R.intro}</p>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="ref-table">
          <thead><tr>{R.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {R.rows.map((row) => (
              <tr key={row[0]}><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card stack">
        {R.notes.map(([head, body]) => <p key={head}><strong>{head}</strong> {body}</p>)}
      </div>
      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.a1c.title}</h2>
        <table className="ref-table">
          <thead><tr>{S.a1c.tableHead.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{S.a1c.tableRows.map((row) => <tr key={row[0]}><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
        </table>
        <p className="sub">{S.a1c.bandsNote}</p>
      </div>
      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{R.howTitle}</h2>
        {R.how.map((line) => <p key={line} className="sub">{line}</p>)}
      </div>
      <p><strong>{S.medical}</strong></p>
    </Page>
  )
}
