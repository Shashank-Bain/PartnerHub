import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const apiHeaders = { 'Content-Type': 'application/json' }

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

const SCALE_LABELS = ['X', 'A', 'P', 'L', 'D']

const SCORECARD_GRADIENT_STOPS = [
  { position: 0, rgb: [192, 0, 0] },
  { position: 25, rgb: [230, 0, 0] },
  { position: 50, rgb: [247, 148, 30] },
  { position: 75, rgb: [122, 184, 0] },
  { position: 100, rgb: [46, 125, 0] },
]

function getScorecardGradientRgbAt(position) {
  const boundedPosition = Math.max(0, Math.min(100, Number(position) || 0))

  for (let index = 1; index < SCORECARD_GRADIENT_STOPS.length; index += 1) {
    const currentStop = SCORECARD_GRADIENT_STOPS[index]
    const previousStop = SCORECARD_GRADIENT_STOPS[index - 1]

    if (boundedPosition <= currentStop.position) {
      const span = currentStop.position - previousStop.position || 1
      const ratio = (boundedPosition - previousStop.position) / span
      const red = Math.round(previousStop.rgb[0] + (currentStop.rgb[0] - previousStop.rgb[0]) * ratio)
      const green = Math.round(previousStop.rgb[1] + (currentStop.rgb[1] - previousStop.rgb[1]) * ratio)
      const blue = Math.round(previousStop.rgb[2] + (currentStop.rgb[2] - previousStop.rgb[2]) * ratio)
      return [red, green, blue]
    }
  }

  const lastStop = SCORECARD_GRADIENT_STOPS[SCORECARD_GRADIENT_STOPS.length - 1]
  return [...lastStop.rgb]
}

function toRgbCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function buildDummyKpiInsights(sectorName, selectedCompany) {
  const key = `${sectorName || ''}-${selectedCompany || ''}-kpi`

  return {
    metrics: [
      { label: 'Decarbonization Velocity', value: `${4 + (hashString(`${key}-carbon`) % 7)}% YoY`, trend: 'Improving' },
      { label: 'Sustainability Capex Yield', value: `${11 + (hashString(`${key}-capex`) % 12)}%`, trend: 'Stable' },
      { label: 'Narrative Credibility Index', value: `${63 + (hashString(`${key}-narrative`) % 28)}/100`, trend: 'At risk' },
    ],
    moves: [
      'Prioritize 2–3 high-visibility KPI commitments with CFO-backed accountability.',
      'Strengthen external narrative with quantified progress and near-term milestones.',
      'Align KPI governance cadence with board and investor communication windows.',
    ],
  }
}

function formatPct(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '0.0%'
  }
  return `${numericValue.toFixed(1)}%`
}

function normalizeStatusKey(status) {
  return String(status || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function getCommitmentStatusClass(status) {
  const statusKey = normalizeStatusKey(status)
  if (statusKey === 'achieved') return 'achieved'
  if (statusKey === 'ontrack') return 'ontrack'
  if (statusKey === 'offtrack') return 'offtrack'
  if (statusKey === 'noreporting' || statusKey === 'notreporting') return 'noreporting'
  return 'others'
}

function formatCommitmentStatus(status) {
  const statusKey = normalizeStatusKey(status)
  if (statusKey === 'noreporting' || statusKey === 'notreporting') {
    return 'Not Reporting'
  }
  return String(status || '').trim() || 'No-target'
}

function getProgressLabelClass(label) {
  const normalized = String(label || '').toLowerCase()
  if (normalized === 'leading') return 'leading'
  if (normalized === 'lagging') return 'lagging'
  return 'atpar'
}

function StatusScaleCell({ overallStatus, peerAverage, bestScore }) {
  const bucketLabelByCode = {
    X: 'No Commitments',
    A: 'Active',
    P: 'Proactive',
    L: 'Leading',
    D: 'Distinctive',
  }

  const toScaleScore = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return 0
    return Math.max(0, Math.min(100, numericValue))
  }

  const companyScore = toScaleScore(overallStatus?.finalScore)
  const peerScore = toScaleScore(peerAverage)
  const best = toScaleScore(bestScore)
  const derivedBucketCode = companyScore >= 80 ? 'D' : companyScore >= 60 ? 'L' : companyScore >= 40 ? 'P' : companyScore >= 20 ? 'A' : 'X'
  const companyBucketCode = String(overallStatus?.bucket || overallStatus?.bucketCode || derivedBucketCode).toUpperCase()
  const companyBucketLabel = bucketLabelByCode[companyBucketCode] || bucketLabelByCode[derivedBucketCode]

  const markers = [
    { type: 'company', longLabel: 'Client', rawScore: companyScore, score: companyScore },
    { type: 'peer', longLabel: 'Peer Avg', rawScore: peerScore, score: peerScore },
    { type: 'best', longLabel: 'Best', rawScore: best, score: best },
  ]

  const sortedMarkers = [...markers].sort((first, second) => first.score - second.score)
  const minGap = 1.4
  for (let index = 1; index < sortedMarkers.length; index += 1) {
    const current = sortedMarkers[index]
    const previous = sortedMarkers[index - 1]
    if (current.score - previous.score < minGap) {
      current.score = Math.min(100, previous.score + minGap)
    }
  }

  for (let index = sortedMarkers.length - 2; index >= 0; index -= 1) {
    const current = sortedMarkers[index]
    const next = sortedMarkers[index + 1]
    if (next.score - current.score < minGap) {
      current.score = Math.max(0, next.score - minGap)
    }
  }

  const markerByType = Object.fromEntries(sortedMarkers.map((marker) => [marker.type, marker]))
  const companyMarker = markerByType.company
  const peerMarker = markerByType.peer
  const bestMarker = markerByType.best

  const bottomLabelMarkers = [
    { type: 'peer', score: peerMarker.score },
    { type: 'best', score: bestMarker.score },
  ].sort((first, second) => first.score - second.score)

  const bottomLabelMinGap = 8
  const bottomLabelEdgePadding = 4

  for (let index = 1; index < bottomLabelMarkers.length; index += 1) {
    const current = bottomLabelMarkers[index]
    const previous = bottomLabelMarkers[index - 1]
    if (current.score - previous.score < bottomLabelMinGap) {
      current.score = Math.min(100 - bottomLabelEdgePadding, previous.score + bottomLabelMinGap)
    }
  }

  for (let index = bottomLabelMarkers.length - 2; index >= 0; index -= 1) {
    const current = bottomLabelMarkers[index]
    const next = bottomLabelMarkers[index + 1]
    if (next.score - current.score < bottomLabelMinGap) {
      current.score = Math.max(bottomLabelEdgePadding, next.score - bottomLabelMinGap)
    }
  }

  const bottomLabelByType = Object.fromEntries(bottomLabelMarkers.map((marker) => [marker.type, marker]))
  const companyLabelBaseRgb = getScorecardGradientRgbAt(companyMarker.score)
  const companyLabelBackground = toRgbCss(companyLabelBaseRgb)

  return (
    <div className="status-scale-wrap">
      <div className="status-client-score">
        <span className="status-client-score-label">Client Score</span>
        <span className="status-client-score-value">{companyScore.toFixed(1)}</span>
      </div>
      <div className="status-scale-track">
        <div className="status-scale-gradient" />
        <span
          className="status-marker-line company"
          style={{ left: `${companyMarker.score}%` }}
          title={`${companyMarker.longLabel} ${companyMarker.rawScore.toFixed(1)}`}
        />
        <span
          className="status-marker-label company"
          style={{
            left: `${companyMarker.score}%`,
            backgroundColor: companyLabelBackground,
            color: '#ffffff',
          }}
        >
          {companyBucketLabel}
        </span>

        <span
          className="status-marker-triangle peer"
          style={{ left: `${peerMarker.score}%` }}
          title={`${peerMarker.longLabel} ${peerMarker.rawScore.toFixed(1)}`}
        />
        <span className="status-marker-label peer" style={{ left: `${bottomLabelByType.peer.score}%` }}>
          P {peerMarker.rawScore.toFixed(1)}
        </span>

        <span
          className="status-marker-triangle best"
          style={{ left: `${bestMarker.score}%` }}
          title={`${bestMarker.longLabel} ${bestMarker.rawScore.toFixed(1)}`}
        />
        <span className="status-marker-label best" style={{ left: `${bottomLabelByType.best.score}%` }}>
          B {bestMarker.rawScore.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function CommitmentProgressTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const row = payload[0]?.payload
  if (!row) {
    return null
  }

  return (
    <div className="commitment-tooltip">
      <strong>{label}</strong>
      <p>Total commitments: {row.totalCommitments}</p>
      <p>Achieved: {row.achievedCount} ({row.achievedPct.toFixed(1)}%)</p>
      <p>On-Track: {row.onTrackCount} ({row.onTrackPct.toFixed(1)}%)</p>
      <p>Off-Track: {row.offTrackCount} ({row.offTrackPct.toFixed(1)}%)</p>
      <p>Not Reporting: {row.noReportingCount} ({row.noReportingPct.toFixed(1)}%)</p>
      <p>No-target: {row.noTargetCount} ({row.noTargetPct.toFixed(1)}%)</p>
    </div>
  )
}

function CommitmentProgressChart({ ranking }) {
  const chartData = (ranking || []).map((item) => {
    const totalCommitments = Number(item.totalCommitments || 0)
    const achievedCount = Number(item.breakdown?.achieved || 0)
    const onTrackCount = Number(item.breakdown?.onTrack || 0)
    const offTrackCount = Number(item.breakdown?.offTrack || 0)
    const noReportingCount = Number(item.breakdown?.noReporting || 0)
    const noTargetCount = Number(item.breakdown?.noTarget || item.breakdown?.others || 0)

    const toPct = (value) => (totalCommitments > 0 ? (value / totalCommitments) * 100 : 0)

    return {
      company: item.isSelected ? `${item.company} (Client)` : item.company,
      totalCommitments,
      achievedCount,
      onTrackCount,
      offTrackCount,
      noReportingCount,
      noTargetCount,
      achievedPct: toPct(achievedCount),
      onTrackPct: toPct(onTrackCount),
      offTrackPct: toPct(offTrackCount),
      noReportingPct: toPct(noReportingCount),
      noTargetPct: toPct(noTargetCount),
    }
  })

  if (!chartData.length) {
    return null
  }

  const chartHeight = Math.max(420, chartData.length * 56)

  return (
    <div className="commitment-progress-chart-wrap">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 22, left: 10, bottom: 54 }}
          barCategoryGap={18}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 104, 144, 0.2)" />
          <XAxis
            dataKey="company"
            type="category"
            interval={0}
            angle={0}
            textAnchor="middle"
            tickMargin={10}
            tick={{ fontSize: 12, fill: '#515a7a' }}
            stroke="rgba(95, 104, 144, 0.35)"
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: '#2f3554' }}
            stroke="rgba(95, 104, 144, 0.35)"
          />
          <Tooltip content={<CommitmentProgressTooltip />} cursor={{ fill: 'rgba(104, 70, 218, 0.08)' }} />
          <Bar dataKey="achievedPct" stackId="commitment" name="Achieved" fill="rgb(136, 216, 123)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="onTrackPct" stackId="commitment" name="On-Track" fill="rgb(195, 232, 148)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="offTrackPct" stackId="commitment" name="Off-Track" fill="rgb(248, 201, 99)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="noReportingPct" stackId="commitment" name="Not Reporting" fill="rgb(248, 179, 186)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="noTargetPct" stackId="commitment" name="No-target" fill="rgb(246, 154, 153)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ThemeSpiderChart({ data, companyName }) {
  if (!data || data.length === 0) {
    return <div className="radar-empty">No theme data</div>
  }

  const toScore = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return 0
    return Math.max(0, Math.min(100, numericValue))
  }

  const axisLabel = (theme) => {
    const text = String(theme || '').trim()
    if (text.length <= 18) return text
    return `${text.slice(0, 18)}…`
  }

  const chartData = data.map((item) => ({
    theme: item.theme,
    axisLabel: axisLabel(item.theme),
    companyScore: toScore(item.companyScore),
    peerAvg: toScore(item.peerAvg),
  }))

  return (
    <div className="radar-wrap">
      <div className="spider-chart-wrap" role="img" aria-label="Theme comparison spider chart">
        <ResponsiveContainer width="100%" height={380}>
          <RechartsRadarChart data={chartData} outerRadius="68%">
            <PolarGrid stroke="rgba(104, 70, 218, 0.24)" radialLines />
            <PolarAngleAxis dataKey="axisLabel" tick={{ fontSize: 11, fill: '#3f4568' }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={6}
              tick={{ fontSize: 10, fill: '#65708f' }}
              axisLine={false}
            />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(1)}`, name]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.theme || ''}
            />
            <Legend />
            <Radar
              name={companyName || 'Company'}
              dataKey="companyScore"
              stroke="rgba(104, 70, 218, 0.9)"
              fill="rgba(104, 70, 218, 0.26)"
              fillOpacity={0.8}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'rgba(104, 70, 218, 1)' }}
            />
            <Radar
              name="Peer average"
              dataKey="peerAvg"
              stroke="rgba(185, 11, 22, 0.85)"
              fill="rgba(185, 11, 22, 0.14)"
              fillOpacity={0.7}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'rgba(185, 11, 22, 0.82)' }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const INVESTMENT_CHART_COLORS = [
  'rgb(166, 166, 166)',
  'rgb(132, 151, 176)',
  'rgb(177, 133, 164)',
  'rgb(224, 196, 76)',
  'rgb(136, 167, 151)',
  'rgb(102, 102, 102)',
  'rgb(68, 94, 114)',
  'rgb(154, 64, 110)',
  'rgb(191, 162, 64)',
  'rgb(79, 112, 96)',
]

const INVESTMENT_CHART_COLORS_EXTENDED = [
  ...INVESTMENT_CHART_COLORS,
  'rgb(218, 0, 0)',
  'rgb(217, 217, 217)',
  'rgb(207, 218, 225)',
  'rgb(226, 209, 219)',
  'rgb(238, 229, 199)',
  'rgb(217, 224, 218)',
  'rgb(0, 0, 0)',
]

function buildHeatmapData(events, rowAccessor, columnAccessor, options = {}) {
  const matrix = {}
  const cellEvents = {}
  const rowTotals = {}
  const columnTotals = {}

  for (const event of events) {
    if (options.excludeGreenCapex && String(event?.source || '').toLowerCase() === 'green capex') {
      continue
    }

    const rowValue = String(rowAccessor(event) || '-').trim() || '-'
    const columnValue = String(columnAccessor(event) || 'Other').trim() || 'Other'

    matrix[rowValue] = matrix[rowValue] || {}
    matrix[rowValue][columnValue] = (matrix[rowValue][columnValue] || 0) + 1

    cellEvents[rowValue] = cellEvents[rowValue] || {}
    cellEvents[rowValue][columnValue] = cellEvents[rowValue][columnValue] || []
    cellEvents[rowValue][columnValue].push(event)

    rowTotals[rowValue] = (rowTotals[rowValue] || 0) + 1
    columnTotals[columnValue] = (columnTotals[columnValue] || 0) + 1
  }

  const sortedRows = Object.keys(rowTotals).sort((left, right) => {
    if (left === '-' && right !== '-') return 1
    if (right === '-' && left !== '-') return -1
    return rowTotals[right] - rowTotals[left] || left.localeCompare(right)
  })

  const maxRows = options.maxRows || 8
  const hasDashRow = sortedRows.includes('-')
  const rowKeys = hasDashRow
    ? sortedRows.filter((rowKey) => rowKey !== '-').slice(0, Math.max(1, maxRows - 1)).concat('-')
    : sortedRows.slice(0, maxRows)

  const maxColumns = options.maxColumns || 5
  const columnKeys = Object.keys(columnTotals)
    .sort((left, right) => columnTotals[right] - columnTotals[left] || left.localeCompare(right))
    .slice(0, maxColumns)

  const maxCellValue = Math.max(
    1,
    ...rowKeys.flatMap((rowKey) => columnKeys.map((columnKey) => matrix[rowKey]?.[columnKey] || 0)),
  )

  return { matrix, cellEvents, rowKeys, columnKeys, maxCellValue }
}

function InvestmentHeatmapChart({ title, timelineYears, rowLabel, rowAccessor, columnAccessor, excludeGreenCapex = false, onCellClick }) {
  const allEvents = (timelineYears || []).flatMap((yearBlock) => yearBlock?.events || [])
  const { matrix, cellEvents, rowKeys, columnKeys, maxCellValue } = buildHeatmapData(allEvents, rowAccessor, columnAccessor, {
    maxRows: 8,
    maxColumns: 5,
    excludeGreenCapex,
  })

  if (!rowKeys.length || !columnKeys.length) {
    return (
      <section className="card scorecard-chart-card">
        <h3 className="scorecard-chart-title">{title}</h3>
        <div className="scorecard-thin-divider" />
        <p>No heatmap data available.</p>
      </section>
    )
  }

  const cellStyle = (value) => {
    const intensity = maxCellValue > 0 && value > 0 ? value / maxCellValue : 0
    const [red, green, blue] = getScorecardGradientRgbAt(intensity * 100)
    const alpha = value > 0 ? (0.18 + intensity * 0.78) : 0.08
    const perceivedLuminance = (red * 299 + green * 587 + blue * 114) / 1000
    return {
      background: `rgba(${red}, ${green}, ${blue}, ${alpha})`,
      color: perceivedLuminance < 145 && alpha > 0.35 ? 'rgb(245, 245, 245)' : 'rgb(20, 24, 34)',
    }
  }

  return (
    <section className="card scorecard-chart-card">
      <h3 className="scorecard-chart-title">{title}</h3>
      <div className="scorecard-thin-divider" />
      <div className="investment-heatmap-wrap">
        <table className="investment-heatmap-table">
          <thead>
            <tr>
              <th>{rowLabel}</th>
              {columnKeys.map((columnKey) => (
                <th key={columnKey}>{columnKey}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rowKey) => (
              <tr key={rowKey}>
                <td>{rowKey}</td>
                {columnKeys.map((columnKey) => {
                  const value = matrix[rowKey]?.[columnKey] || 0
                  const eventsForCell = cellEvents[rowKey]?.[columnKey] || []
                  const isClickable = value > 0 && typeof onCellClick === 'function'
                  return (
                    <td key={`${rowKey}-${columnKey}`}>
                      {isClickable ? (
                        <button
                          type="button"
                          className="investment-heatmap-cell investment-heatmap-cell-btn"
                          style={cellStyle(value)}
                          onClick={() => onCellClick({
                            title,
                            rowLabel,
                            rowValue: rowKey,
                            columnValue: columnKey,
                            events: eventsForCell,
                          })}
                        >
                          {value}
                        </button>
                      ) : (
                        <span className="investment-heatmap-cell" style={cellStyle(value)}>{value}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InvestmentStackedChart({ title, breakdown }) {
  const rows = breakdown?.rows || []
  const keys = breakdown?.keys || []

  if (!rows.length || !keys.length) {
    return (
      <section className="card scorecard-chart-card">
        <h3 className="scorecard-chart-title">{title}</h3>
        <div className="scorecard-thin-divider" />
        <p>No chart data available.</p>
      </section>
    )
  }

  return (
    <section className="card scorecard-chart-card">
      <h3 className="scorecard-chart-title">{title}</h3>
      <div className="scorecard-thin-divider" />
      <div className="investment-chart-wrap">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows} margin={{ top: 8, right: 14, left: 4, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(132, 151, 176, 0.28)" />
            <XAxis
              dataKey="company"
              type="category"
              interval={0}
              tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }}
              stroke="rgba(132, 151, 176, 0.5)"
            />
            <YAxis
              type="number"
              tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }}
              stroke="rgba(132, 151, 176, 0.5)"
              allowDecimals={false}
            />
            <Tooltip />
            <Legend />
            {keys.map((key, index) => (
              <Bar key={key} dataKey={key} stackId="investment" fill={INVESTMENT_CHART_COLORS_EXTENDED[index % INVESTMENT_CHART_COLORS_EXTENDED.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function InvestmentDealHeatmapChart({ title, timelineYears, onCellClick }) {
  const normalizeDealType = (rawDealType) => {
    const text = String(rawDealType || '').toLowerCase().trim()
    if (!text || text === '-') return 'Other'
    if (text.includes('minority investment')) return 'Minority Investment'
    if (text.includes('majority investment') || text.includes('control acquisition')) return 'Majority Investment'
    if (text.includes('full acquisition')) return 'Full Acquisition'
    if (text.includes('divestment') || text.includes('exit')) return 'Divestment / Exit'
    if (text.includes('spin-off') || text.includes('spin off') || text.includes('split-off') || text.includes('demerger')) return 'Spin-off / Demerger'
    if (text.includes('sponsor')) return 'Sponsor'
    if (text.includes('strategic')) return 'Strategic'
    return 'Other'
  }

  const normalizeIndustry = (rawIndustry) => {
    const text = String(rawIndustry || '').trim()
    if (!text || text === '-') return '-'
    return text
  }

  return (
    <InvestmentHeatmapChart
      title={title}
      timelineYears={timelineYears}
      rowLabel="Target Industry"
      rowAccessor={(event) => normalizeIndustry(event?.targetIndustry || event?.theme)}
      columnAccessor={(event) => normalizeDealType(event?.dealType)}
      excludeGreenCapex
      onCellClick={onCellClick}
    />
  )
}

function SustainabilityDealsTrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const row = payload[0]?.payload
  if (!row) {
    return null
  }

  return (
    <div className="commitment-tooltip">
      <strong>{label}</strong>
      <p>Sustainability deal share: {formatPct(row.sustainabilityPct)}</p>
      <p>Peer average: {formatPct(row.peerAvgPct)}</p>
    </div>
  )
}

function SustainabilityDealsTrendChart({ data, selectedCompany }) {
  if (!data?.length) {
    return null
  }

  return (
    <div className="investment-trend-chart-wrap">
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 2, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(132, 151, 176, 0.28)" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }}
            stroke="rgba(132, 151, 176, 0.5)"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }}
            stroke="rgba(132, 151, 176, 0.5)"
          />
          <Tooltip content={<SustainabilityDealsTrendTooltip />} cursor={{ fill: 'rgba(207, 218, 225, 0.28)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="sustainabilityPct" name={selectedCompany || 'Selected company'} fill="rgb(68, 94, 114)" radius={[6, 6, 0, 0]} />
          <Line
            type="monotone"
            dataKey="peerAvgPct"
            name="Peer average"
            stroke="rgb(154, 64, 110)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'rgb(154, 64, 110)' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function RegionMixChart({ regionShares }) {
  const chartData = (regionShares || []).slice(0, 5).map((item) => ({
    region: item.region,
    sharePct: Number(item.sharePct || 0),
  }))

  if (!chartData.length) {
    return <p>No region mix data available.</p>
  }

  return (
    <div className="investment-trend-chart-wrap">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(132, 151, 176, 0.28)" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }} stroke="rgba(132, 151, 176, 0.5)" />
          <YAxis type="category" dataKey="region" width={110} tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }} stroke="rgba(132, 151, 176, 0.5)" />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Share']} />
          <Bar dataKey="sharePct" name="Region share" fill="rgb(136, 167, 151)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function MixDistributionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const sortedItems = [...payload]
    .filter((entry) => Number(entry?.value || 0) > 0)
    .sort((left, right) => Number(right?.value || 0) - Number(left?.value || 0))

  return (
    <div className="commitment-tooltip">
      <strong>{label}</strong>
      {sortedItems.length ? (
        sortedItems.map((entry) => (
          <p key={`${entry?.dataKey}-${entry?.name}`}>
            <span>{entry?.name || entry?.dataKey}:</span>{' '}
            <strong>{`${Number(entry?.value || 0).toFixed(1)}%`}</strong>
          </p>
        ))
      ) : (
        <p>No mix contribution.</p>
      )}
    </div>
  )
}

function MixDistributionLegend({ orderedKeys, colorByKey }) {
  return (
    <div className="mix-distribution-legend" role="list" aria-label="Mix legend">
      {orderedKeys.map((key) => (
        <span key={key} className="mix-distribution-legend-item" role="listitem">
          <i className="mix-distribution-legend-swatch" style={{ backgroundColor: colorByKey[key] }} />
          {key}
        </span>
      ))}
    </div>
  )
}

function MixDistributionChart({ title, keys, rows, selectedCompany, tall = false }) {
  const safeKeys = (keys || []).filter(Boolean)
  const sourceRows = rows || []

  const normalizeCompanyToken = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const selectedCompanyToken = normalizeCompanyToken(selectedCompany)

  const selectedSourceRow = sourceRows.find((row) => Boolean(row?.isSelected))
    || sourceRows.find((row) => normalizeCompanyToken(row?.company) === selectedCompanyToken)
    || sourceRows[0]
    || {}

  const orderedKeys = [...safeKeys]
    .map((key) => {
      const clientCount = Number(selectedSourceRow?.[key] || 0)
      const totalCount = sourceRows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0)
      return {
        key,
        clientCount,
        totalCount,
        hasClientSegment: clientCount > 0,
      }
    })
    .sort((left, right) => {
      if (left.hasClientSegment !== right.hasClientSegment) {
        return left.hasClientSegment ? -1 : 1
      }

      if (right.clientCount !== left.clientCount) {
        return right.clientCount - left.clientCount
      }

      if (right.totalCount !== left.totalCount) {
        return right.totalCount - left.totalCount
      }

      return left.key.localeCompare(right.key)
    })
    .map((item) => item.key)

  const chartData = sourceRows.map((row) => {
    const totalDeals = orderedKeys.reduce((sum, key) => sum + Number(row?.[key] || 0), 0)
    const payload = {
      company: row?.isSelected ? `${row.company} (Client)` : row.company,
      companyRaw: String(row?.company || ''),
      isSelected: Boolean(row?.isSelected),
      totalDeals,
      totalPct: totalDeals > 0 ? 100 : 0,
    }

    for (const key of orderedKeys) {
      const count = Number(row?.[key] || 0)
      payload[key] = totalDeals > 0 ? (count / totalDeals) * 100 : 0
    }

    return payload
  }).sort((left, right) => {
    if (left.isSelected && !right.isSelected) return -1
    if (!left.isSelected && right.isSelected) return 1
    if (right.totalDeals !== left.totalDeals) return right.totalDeals - left.totalDeals
    return left.companyRaw.localeCompare(right.companyRaw)
  })

  const colorByKey = Object.fromEntries(
    orderedKeys.map((key, index) => [
      key,
      INVESTMENT_CHART_COLORS_EXTENDED[index % INVESTMENT_CHART_COLORS_EXTENDED.length],
    ]),
  )

  if (!chartData.length || !orderedKeys.length) {
    return (
      <section className="card scorecard-chart-card">
        <h3 className="scorecard-chart-title">{title}</h3>
        <div className="scorecard-thin-divider" />
        <p>No mix data available.</p>
      </section>
    )
  }

  return (
    <section className="card scorecard-chart-card">
      <h3 className="scorecard-chart-title">{title}</h3>
      <div className="scorecard-thin-divider" />
      <div className="investment-chart-wrap investment-mix-chart-wrap">
        <ResponsiveContainer width="100%" height={Math.max(tall ? 360 : 240, chartData.length * (tall ? 66 : 44))}>
          <BarChart data={chartData} margin={{ top: 20, right: 12, left: 4, bottom: 54 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(132, 151, 176, 0.28)" />
            <XAxis
              dataKey="company"
              type="category"
              interval={0}
              tick={{ fontSize: 10, fill: 'rgb(68, 94, 114)' }}
              stroke="rgba(132, 151, 176, 0.5)"
              tickMargin={10}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              allowDecimals={false}
              tickFormatter={(value) => `${Math.round(Number(value) || 0)}%`}
              tick={{ fontSize: 12, fill: 'rgb(68, 94, 114)' }}
              stroke="rgba(132, 151, 176, 0.5)"
            />
            <Tooltip
              content={<MixDistributionTooltip />}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              content={() => <MixDistributionLegend orderedKeys={orderedKeys} colorByKey={colorByKey} />}
            />
            {orderedKeys.map((key, index) => (
              <Bar
                key={`${title}-${key}`}
                dataKey={key}
                stackId="mix"
                name={key}
                fill={colorByKey[key]}
              >
                {index === orderedKeys.length - 1 && (
                  <LabelList dataKey="totalDeals" position="top" formatter={(value) => `${Number(value || 0)}`} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function formatTransactionValue(value) {
  const text = String(value || '').trim()
  if (!text || text === '-') {
    return 'NA'
  }
  return text
}

function formatIndustryLabel(value) {
  const text = String(value || '').trim()
  if (!text || text === '-') {
    return 'Other industry'
  }
  if (text.toLowerCase() === 'consumer') {
    return 'Consumer Products'
  }
  return text
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [sectors, setSectors] = useState([])
  const [sectorCompanyMap, setSectorCompanyMap] = useState({})
  const [selectedSector, setSelectedSector] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [materialTopicComparison, setMaterialTopicComparison] = useState(null)
  const [isMaterialTopicLoading, setIsMaterialTopicLoading] = useState(false)
  const [recommendations, setRecommendations] = useState(null)
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false)
  const [commitmentOverview, setCommitmentOverview] = useState(null)
  const [isCommitmentOverviewLoading, setIsCommitmentOverviewLoading] = useState(false)
  const [scorecardData, setScorecardData] = useState(null)
  const [isScorecardLoading, setIsScorecardLoading] = useState(false)
  const [investmentInsights, setInvestmentInsights] = useState(null)
  const [isInvestmentInsightsLoading, setIsInvestmentInsightsLoading] = useState(false)
  const [activeModal, setActiveModal] = useState(null)
  const [selectedThemeRationale, setSelectedThemeRationale] = useState(null)
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState(null)
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState(null)
  const [expandedScorecardThemes, setExpandedScorecardThemes] = useState({})

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeView, setActiveView] = useState('home')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('')
  const [settingsNewPassword, setSettingsNewPassword] = useState('')
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)

  const [users, setUsers] = useState([])
  const [allSectors, setAllSectors] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [adminFormEmail, setAdminFormEmail] = useState('')
  const [adminFormPassword, setAdminFormPassword] = useState('')
  const [adminFormFirstName, setAdminFormFirstName] = useState('')
  const [adminFormLastName, setAdminFormLastName] = useState('')
  const [adminFormSectors, setAdminFormSectors] = useState([])
  const [adminFormIsAdmin, setAdminFormIsAdmin] = useState(false)
  const [isLogoAvailable, setIsLogoAvailable] = useState(true)

  const userMenuRef = useRef(null)
  const greeting = useMemo(() => getGreeting(), [])
  const companies = selectedSector ? sectorCompanyMap[selectedSector] || [] : []
  const kpiInsights = useMemo(
    () => buildDummyKpiInsights(selectedSector, selectedCompany),
    [selectedSector, selectedCompany],
  )
  const kpiTrendSummary = useMemo(() => {
    const metrics = kpiInsights?.metrics || []
    const improvingCount = metrics.filter((metric) => metric.trend?.toLowerCase() === 'improving').length
    const stableCount = metrics.filter((metric) => metric.trend?.toLowerCase() === 'stable').length
    const riskCount = metrics.filter((metric) => metric.trend?.toLowerCase() === 'at risk').length

    return {
      total: metrics.length,
      improvingCount,
      stableCount,
      riskCount,
    }
  }, [kpiInsights])
  const investmentTrendData = useMemo(() => {
    const trendRows = investmentInsights?.sustainabilityTrend || []
    if (trendRows.length) {
      return trendRows
    }

    return []
  }, [investmentInsights])
  const investmentFocusMatrix = useMemo(() => {
    const fallbackTopics = ['Energy Efficiency', 'Circularity', 'Low-Carbon Supply Chain']

    const selectedDealFocus = (investmentInsights?.topClassifications || [])
      .map((item) => item?.label)
      .filter(Boolean)
      .slice(0, 3)

    const selectedCapexFocus = (investmentInsights?.greenCapexCategories || [])
      .map((item) => item?.label)
      .filter(Boolean)
      .slice(0, 3)

    const peerTopicTotals = {}
    for (const row of investmentInsights?.charts?.topics?.rows || []) {
      if (row?.isSelected) {
        continue
      }

      for (const [key, value] of Object.entries(row || {})) {
        if (['company', 'isSelected', 'Other'].includes(key)) {
          continue
        }
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
          continue
        }
        peerTopicTotals[key] = (peerTopicTotals[key] || 0) + numericValue
      }
    }

    const peerFocusTopics = Object.entries(peerTopicTotals)
      .sort((first, second) => second[1] - first[1])
      .map(([topic]) => topic)
      .slice(0, 3)

    return {
      selectedDealFocus: selectedDealFocus.length ? selectedDealFocus : (investmentInsights?.topSustainabilityTopics || []).slice(0, 3).concat(fallbackTopics).slice(0, 3),
      selectedCapexFocus: selectedCapexFocus.length ? selectedCapexFocus : (investmentInsights?.topTopics2025_26 || []).map((item) => item?.label).filter(Boolean).slice(0, 3).concat(fallbackTopics).slice(0, 3),
      peerDealFocus: peerFocusTopics.length ? peerFocusTopics : fallbackTopics,
      peerCapexFocus: peerFocusTopics.length ? [...peerFocusTopics].reverse().slice(0, 3) : fallbackTopics,
    }
  }, [investmentInsights])
  const investmentCardFocus = useMemo(() => {
    const fallbackDealFocus = ['Circular Economy', 'Sustainable Mobility']
    const fallbackCapexFocus = ['Renewable Power', 'Energy Storage']

    const dealFocus = [...new Set(investmentFocusMatrix.selectedDealFocus || [])].slice(0, 2)
    const capexCandidates = [...new Set(investmentFocusMatrix.selectedCapexFocus || [])]
    const capexFocus = capexCandidates.filter((topic) => !dealFocus.includes(topic)).slice(0, 2)

    const resolvedDealFocus = dealFocus.length === 2 ? dealFocus : fallbackDealFocus
    const resolvedCapexFocus = capexFocus
      .concat(fallbackCapexFocus)
      .filter((topic, index, source) => !resolvedDealFocus.includes(topic) && source.indexOf(topic) === index)
      .slice(0, 2)

    return {
      dealFocus: resolvedDealFocus,
      capexFocus: resolvedCapexFocus.length === 2 ? resolvedCapexFocus : fallbackCapexFocus,
    }
  }, [investmentFocusMatrix])
  const investmentSustainabilityMix = useMemo(() => ({
    keys: investmentInsights?.charts?.topics?.keys || [],
    rows: investmentInsights?.charts?.topics?.rows || [],
  }), [investmentInsights])

  const investmentRegionMix = useMemo(() => ({
    keys: investmentInsights?.charts?.regions?.keys || [],
    rows: investmentInsights?.charts?.regions?.rows || [],
  }), [investmentInsights])

  const investmentTargetIndustryMix = useMemo(() => ({
    keys: investmentInsights?.charts?.targetIndustries?.keys || [],
    rows: investmentInsights?.charts?.targetIndustries?.rows || [],
  }), [investmentInsights])

  const investmentDealTypeMix = useMemo(() => ({
    keys: investmentInsights?.charts?.dealTypes?.keys || [],
    rows: investmentInsights?.charts?.dealTypes?.rows || [],
  }), [investmentInsights])
  const scorecardBucketLegend = useMemo(() => {
    const providedLegend = scorecardData?.bucketLegend || []
    if (providedLegend.length) {
      return providedLegend
    }
    return [
      { code: 'X', label: 'No Commitments' },
      { code: 'A', label: 'Active' },
      { code: 'P', label: 'Proactive' },
      { code: 'L', label: 'Leading' },
      { code: 'D', label: 'Distinctive' },
    ]
  }, [scorecardData])
  const scorecardBucketLabelByCode = useMemo(
    () => Object.fromEntries(scorecardBucketLegend.map((item) => [item.code, item.label])),
    [scorecardBucketLegend],
  )

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const authRes = await fetch('/api/auth/me', { credentials: 'include' })
        if (authRes.ok) {
          const authData = await authRes.json()
          setUser(authData.user)
          setFirstName(authData.user.firstName)
          setLastName(authData.user.lastName)
          await loadOptions(authData.user)
          if (authData.user.isAdmin) {
            await loadAdminData()
          }
        }
      } catch {
        setError('Unable to connect to backend. Please start Flask server.')
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveModal(null)
        setSelectedThemeRationale(null)
        setSelectedTimelineEvent(null)
      }
    }

    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!companies.includes(selectedCompany)) {
      setSelectedCompany(companies[0] || '')
    }
  }, [companies, selectedCompany])

  useEffect(() => {
    if (!user || !selectedSector || !selectedCompany) {
      setMaterialTopicComparison(null)
      setIsMaterialTopicLoading(false)
      setRecommendations(null)
      setIsRecommendationsLoading(false)
      setCommitmentOverview(null)
      setIsCommitmentOverviewLoading(false)
      setScorecardData(null)
      setIsScorecardLoading(false)
      setExpandedScorecardThemes({})
      setSelectedThemeRationale(null)
      setInvestmentInsights(null)
      setIsInvestmentInsightsLoading(false)
      return
    }

    setExpandedScorecardThemes({})
    setSelectedThemeRationale(null)

    loadMaterialTopicComparison(selectedSector, selectedCompany)
    loadRecommendations(selectedSector, selectedCompany)
    loadCommitmentOverview(selectedSector, selectedCompany)
    loadScorecard(selectedSector, selectedCompany)
    loadInvestmentInsights(selectedSector, selectedCompany)
  }, [user, selectedSector, selectedCompany])

  const clearAlerts = () => {
    setError('')
    setMessage('')
  }

  const resetAdminForm = () => {
    setEditingUserId(null)
    setAdminFormEmail('')
    setAdminFormPassword('')
    setAdminFormFirstName('')
    setAdminFormLastName('')
    setAdminFormSectors([])
    setAdminFormIsAdmin(false)
  }

  const loadOptions = async () => {
    const optionsRes = await fetch('/api/options', { credentials: 'include' })
    if (!optionsRes.ok) {
      setSectors([])
      setSectorCompanyMap({})
      setSelectedSector('')
      setSelectedCompany('')
      return
    }

    const optionsData = await optionsRes.json()
    const nextSectors = optionsData.sectors || []
    const nextMap = optionsData.sectorCompanyMap || {}
    const nextSector = nextSectors[0] || ''
    const nextCompanies = nextSector ? nextMap[nextSector] || [] : []

    setSectors(nextSectors)
    setSectorCompanyMap(nextMap)
    setSelectedSector(nextSector)
    setSelectedCompany(nextCompanies[0] || '')
  }

  const loadAdminData = async () => {
    const [metadataRes, usersRes] = await Promise.all([
      fetch('/api/admin/metadata', { credentials: 'include' }),
      fetch('/api/admin/users', { credentials: 'include' }),
    ])

    if (metadataRes.ok) {
      const metadataData = await metadataRes.json()
      setAllSectors(metadataData.sectors || [])
    }

    if (usersRes.ok) {
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])
    }
  }

  const loadMaterialTopicComparison = async (sectorName, companyName) => {
    setIsMaterialTopicLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/material-topics/comparison?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setMaterialTopicComparison(null)
        return
      }

      const data = await res.json()
      setMaterialTopicComparison(data)
    } catch {
      setMaterialTopicComparison(null)
    } finally {
      setIsMaterialTopicLoading(false)
    }
  }

  const loadRecommendations = async (sectorName, companyName) => {
    setIsRecommendationsLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/recommendations?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setRecommendations(null)
        return
      }

      const data = await res.json()
      setRecommendations(data)
    } catch {
      setRecommendations(null)
    } finally {
      setIsRecommendationsLoading(false)
    }
  }

  const loadCommitmentOverview = async (sectorName, companyName) => {
    setIsCommitmentOverviewLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/commitments/overview?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setCommitmentOverview(null)
        return
      }

      const data = await res.json()
      setCommitmentOverview(data)
    } catch {
      setCommitmentOverview(null)
    } finally {
      setIsCommitmentOverviewLoading(false)
    }
  }

  const loadScorecard = async (sectorName, companyName) => {
    setIsScorecardLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/scorecard?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setScorecardData(null)
        return
      }

      const data = await res.json()
      setScorecardData(data)
    } catch {
      setScorecardData(null)
    } finally {
      setIsScorecardLoading(false)
    }
  }

  const loadInvestmentInsights = async (sectorName, companyName) => {
    setIsInvestmentInsightsLoading(true)

    try {
      const query = new URLSearchParams({ sector: sectorName, company: companyName })
      const res = await fetch(`/api/investments/insights?${query.toString()}`, { credentials: 'include' })

      if (!res.ok) {
        setInvestmentInsights(null)
        return
      }

      const data = await res.json()
      setInvestmentInsights(data)
    } catch {
      setInvestmentInsights(null)
    } finally {
      setIsInvestmentInsightsLoading(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    clearAlerts()

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Login failed.')
        return
      }

      setUser(data.user)
      setFirstName(data.user.firstName)
      setLastName(data.user.lastName)
      setEmail('')
      setPassword('')
      setMessage('Login successful.')

      await loadOptions()
      if (data.user.isAdmin) {
        await loadAdminData()
      }
    } catch {
      setError('Unable to login right now.')
    }
  }

  const handleLogout = async () => {
    clearAlerts()
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setIsUserMenuOpen(false)
    setShowChangePassword(false)
    setActiveModal(null)
    setSelectedThemeRationale(null)
    setActiveView('home')
    setCommitmentOverview(null)
    setScorecardData(null)
    setInvestmentInsights(null)
    setUsers([])
    setAllSectors([])
    resetAdminForm()
    setMessage('Logged out successfully.')
  }

  const toggleScorecardThemeExpansion = (themeName) => {
    setExpandedScorecardThemes((current) => ({
      ...current,
      [themeName]: !current[themeName],
    }))
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    clearAlerts()

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({ firstName, lastName }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to save profile.')
        return
      }

      setUser(data.user)
      setMessage('Profile updated successfully.')
    } catch {
      setError('Unable to save profile right now.')
    }
  }

  const handleSettingsPasswordChange = async (event) => {
    event.preventDefault()
    clearAlerts()

    if (settingsNewPassword !== settingsConfirmPassword) {
      setError('New password and confirm password must match.')
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify({
          currentPassword: settingsCurrentPassword,
          newPassword: settingsNewPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to change password.')
        return
      }

      setUser(data.user)
      setSettingsCurrentPassword('')
      setSettingsNewPassword('')
      setSettingsConfirmPassword('')
      setShowChangePassword(false)
      setMessage('Password changed successfully.')
    } catch {
      setError('Unable to change password right now.')
    }
  }

  const toggleAdminSector = (sectorName) => {
    setAdminFormSectors((current) => {
      if (current.includes(sectorName)) {
        return current.filter((sector) => sector !== sectorName)
      }
      return [...current, sectorName]
    })
  }

  const handleEditUser = (targetUser) => {
    setEditingUserId(targetUser.id)
    setAdminFormEmail(targetUser.email)
    setAdminFormPassword('')
    setAdminFormFirstName(targetUser.firstName)
    setAdminFormLastName(targetUser.lastName)
    setAdminFormSectors(targetUser.sectors || [])
    setAdminFormIsAdmin(!!targetUser.isAdmin)
  }

  const handleAdminUserSubmit = async (event) => {
    event.preventDefault()
    clearAlerts()

    if (!adminFormEmail || !adminFormFirstName || !adminFormLastName) {
      setError('Email, first name and last name are required.')
      return
    }

    if (!editingUserId && !adminFormPassword) {
      setError('Password is required while adding a user.')
      return
    }

    const payload = {
      firstName: adminFormFirstName,
      lastName: adminFormLastName,
      sectors: adminFormSectors,
      isAdmin: adminFormIsAdmin,
    }

    if (editingUserId) {
      if (adminFormPassword.trim()) {
        payload.password = adminFormPassword.trim()
      }
    } else {
      payload.email = adminFormEmail.trim().toLowerCase()
      payload.password = adminFormPassword
    }

    const endpoint = editingUserId ? `/api/admin/users/${editingUserId}` : '/api/admin/users'
    const method = editingUserId ? 'PUT' : 'POST'

    try {
      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: apiHeaders,
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to save user.')
        return
      }

      await loadAdminData()
      await loadOptions()
      const successMessage = editingUserId ? 'User updated successfully.' : 'User created successfully.'
      const warningSuffix = data.storageWarning ? ` ${data.storageWarning}` : ''
      setMessage(`${successMessage}${warningSuffix}`)
      resetAdminForm()
    } catch {
      setError('Unable to save user right now.')
    }
  }

  const handleDeleteUser = async (targetUser) => {
    clearAlerts()

    const confirmed = window.confirm(`Delete user ${targetUser.email}?`)
    if (!confirmed) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Unable to delete user.')
        return
      }

      await loadAdminData()
      await loadOptions()
      const warningSuffix = data.storageWarning ? ` ${data.storageWarning}` : ''
      setMessage(`User deleted successfully.${warningSuffix}`)
      if (editingUserId === targetUser.id) {
        resetAdminForm()
      }
    } catch {
      setError('Unable to delete user right now.')
    }
  }

  if (isLoading) {
    return (
      <div className="screen-center">
        <div className="card">Loading Pulse Partner Hub...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="screen-center app-bg">
        <form className="card auth-card" onSubmit={handleLogin}>
          <h1>Pulse Partner Hub</h1>
          <div className="gradient-line" />
          <p className="subtitle">Please login with your email and password.</p>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />

          <button type="submit" className="btn-primary">Login</button>
        </form>
      </div>
    )
  }

  return (
    <div className="app-bg dashboard-wrap">
      <nav className="navbar">
        <div className="logo-wrap">
          <button
            type="button"
            className="logo-placeholder"
            onClick={() => {
              setActiveView('home')
              setIsUserMenuOpen(false)
            }}
          >
            {isLogoAvailable ? (
              <img
                src="/Logo.png"
                alt="Pulse Partner Hub Logo"
                className="logo-image"
                onError={() => setIsLogoAvailable(false)}
              />
            ) : (
              <span>Logo</span>
            )}
          </button>
        </div>

        <div className="nav-main-center">
          <div className="nav-greeting">
            <h2>{greeting}, {user.firstName}</h2>
          </div>

          <div className="nav-filters">
            <label className="nav-filter-control">
              <span>Sector</span>
              <select value={selectedSector} onChange={(event) => setSelectedSector(event.target.value)}>
                {sectors.map((sector) => (
                  <option value={sector} key={sector}>{sector}</option>
                ))}
              </select>
            </label>

            <label className="nav-filter-control">
              <span>Company</span>
              <select value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)}>
                {companies.map((company) => (
                  <option value={company} key={company}>{company}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="nav-actions">

          {user.isAdmin && (
            <button
              type="button"
              className={`nav-tab ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              Users
            </button>
          )}

          <div className="user-menu" ref={userMenuRef}>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsUserMenuOpen((value) => !value)}
            >
              👤
            </button>

            {isUserMenuOpen && (
              <div className="dropdown-menu">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('settings')
                    setIsUserMenuOpen(false)
                  }}
                >
                  Settings
                </button>
                <button type="button" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="main-content">
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        {activeView === 'home' && (
          <section className="home-section">
            <div className="home-card-grid">
              <article className="card home-insight-card">
                <h3>Performance Highlights</h3>
                <p className="card-subtitle">Where your client wins and where it slips vs. peers</p>
                <div className="gradient-line" />
                <p>Track where client performance stands out or underperforms versus sector peers.</p>
              </article>

              <article className="card home-insight-card">
                <h3>Material Topic Benchmark</h3>
                <p className="card-subtitle">How your client’s priorities stack up across competitors</p>
                <div className="gradient-line" />

                {isMaterialTopicLoading && (
                  <p>Loading material topic comparison...</p>
                )}

                {!isMaterialTopicLoading && materialTopicComparison && (
                  <div className="benchmark-table-wrap">
                    <table className="benchmark-table">
                      <thead>
                        <tr>
                          <th>{materialTopicComparison.selectedCompany} Material Topics</th>
                          {materialTopicComparison.competitorCompanies.map((companyName) => (
                            <th key={companyName}>{companyName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {materialTopicComparison.rows.map((row) => (
                          <tr key={row.materialTopic}>
                            <td>{row.materialTopic}</td>
                            {materialTopicComparison.competitorCompanies.map((companyName) => (
                              <td key={`${row.materialTopic}-${companyName}`} className="benchmark-status-cell">
                                {row.competitorMatches[companyName] ? (
                                  <span className="status-tick" title="Present">✓</span>
                                ) : (
                                  <span className="status-cross" title="Not Present">✕</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!isMaterialTopicLoading && !materialTopicComparison && (
                  <p>No material topic data available for this selection.</p>
                )}
              </article>

              <article className="card home-insight-card">
                <h3>Strategic Actions</h3>
                <p className="card-subtitle">High-conviction moves to open strategic client conversations</p>
                <div className="gradient-line" />

                {isRecommendationsLoading && (
                  <p>Loading strategic actions...</p>
                )}

                {!isRecommendationsLoading && recommendations && recommendations.actions?.length > 0 && (
                  <ol className="recommendation-list">
                    {recommendations.actions.map((action) => (
                      <li key={action.topic}>
                        <p className="recommendation-topic">{action.topic}</p>
                        {action.details?.length > 0 && (
                          <ul className="recommendation-details">
                            {action.details.map((detail) => (
                              <li key={detail}>{detail}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {!isRecommendationsLoading && (!recommendations || !recommendations.actions?.length) && (
                  <p>No strategic actions available for this selection.</p>
                )}
              </article>
            </div>

            <div className="home-card-grid-two">
              <article
                className="card home-insight-card interactive-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveModal('commitments')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveModal('commitments')
                  }
                }}
              >
                <div className="card-heading-row">
                  <h3>Commitment Progress</h3>
                  <span className="card-see-more">See More</span>
                </div>
                <p className="card-subtitle">Commitment delivery and peer-positioning at a glance</p>
                <div className="gradient-line" />

                <div className="commitment-infographic">
                  <section className="commitment-summary-band">
                    {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading commitment overview...</p>}
                    {!isCommitmentOverviewLoading && commitmentOverview && (
                      <>
                        <div className="commitment-summary-main">
                          <div className="commitment-total-tile">
                            <span>Total Commitments</span>
                            <strong>{commitmentOverview.totalCommitments}</strong>
                          </div>
                          <div className="commitment-summary-metrics">
                            <article className="commitment-stat-tile positive">
                              <span>Achieved + On-track</span>
                              <strong>{commitmentOverview.achievedOnTrackPct}%</strong>
                            </article>
                            <article className="commitment-stat-tile risk">
                              <span>Off-track</span>
                              <strong>{commitmentOverview.offTrackPct}%</strong>
                            </article>
                          </div>
                        </div>
                      </>
                    )}
                    {!isCommitmentOverviewLoading && !commitmentOverview && (
                      <p className="commitment-section-message">No commitment overview available.</p>
                    )}
                  </section>

                  <div className="commitment-focus-grid">
                    <section className="commitment-focus-card leading">
                      <div className="commitment-focus-head">
                        <h4>Leading Themes</h4>
                        <span className="theme-count positive">{(commitmentOverview?.leadingThemes || []).length}</span>
                      </div>
                      <p className="commitment-focus-caption">Areas where execution is strongest</p>
                      {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading themes...</p>}
                      {!isCommitmentOverviewLoading && !!(commitmentOverview?.leadingThemes || []).length && (
                        <ul className="commitment-theme-list">
                          {(commitmentOverview?.leadingThemes || []).map((theme) => (
                            <li key={theme} className="theme-pill positive">{theme}</li>
                          ))}
                        </ul>
                      )}
                      {!isCommitmentOverviewLoading && !(commitmentOverview?.leadingThemes || []).length && (
                        <p className="commitment-section-message">No leading themes available.</p>
                      )}
                    </section>

                    <section className="commitment-focus-card gaps">
                      <div className="commitment-focus-head">
                        <h4>Gaps</h4>
                        <span className="theme-count risk">{(commitmentOverview?.laggingThemes || []).length}</span>
                      </div>
                      <p className="commitment-focus-caption">Themes requiring intervention now</p>
                      {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading gaps...</p>}
                      {!isCommitmentOverviewLoading && !!(commitmentOverview?.laggingThemes || []).length && (
                        <ul className="commitment-theme-list">
                          {(commitmentOverview?.laggingThemes || []).map((theme) => (
                            <li key={theme} className="theme-pill risk">{theme}</li>
                          ))}
                        </ul>
                      )}
                      {!isCommitmentOverviewLoading && !(commitmentOverview?.laggingThemes || []).length && (
                        <p className="commitment-section-message">No gap themes available.</p>
                      )}
                    </section>
                  </div>
                </div>
              </article>

              <article
                className="card home-insight-card interactive-card investment-intelligence-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveModal('investment')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveModal('investment')
                  }
                }}
              >
                <div className="card-heading-row">
                  <h3>Investment Intelligence</h3>
                  <span className="card-see-more">See More</span>
                </div>
                <p className="card-subtitle">Deals, green capex, and strategic intent at a glance</p>
                <div className="gradient-line" />

                <div className="investment-infographic">
                  {isInvestmentInsightsLoading && <p className="commitment-section-message">Loading investment insights...</p>}

                  {!isInvestmentInsightsLoading && investmentInsights && (
                    <section className="investment-intel-layout">
                      <div className="investment-intel-kpi-column">
                        <article className="commitment-total-tile investment-intel-kpi-card">
                          <span>Total Deals in Sustainability</span>
                          <strong>{investmentInsights.summary?.dealCount || 0}</strong>
                        </article>
                        <article className="commitment-total-tile investment-intel-kpi-card">
                          <span>Total Green Capex Investment</span>
                          <strong>{investmentInsights.summary?.greenCapexCount || 0}</strong>
                        </article>
                      </div>

                      <section className="investment-intel-focus-column">
                        <article className="investment-intel-focus-card">
                          <h4>Sustainability Deal Focus</h4>
                          <div className="investment-topic-cell-list">
                            {investmentCardFocus.dealFocus.map((topic) => (
                              <span key={`card-deal-${topic}`} className="investment-chip">{topic}</span>
                            ))}
                          </div>
                        </article>
                        <article className="investment-intel-focus-card">
                          <h4>Green Capex Focus</h4>
                          <div className="investment-topic-cell-list">
                            {investmentCardFocus.capexFocus.map((topic) => (
                              <span key={`card-capex-${topic}`} className="investment-chip">{topic}</span>
                            ))}
                          </div>
                        </article>
                      </section>

                      <section className="investment-intel-trend-card">
                        <h4>% Deals Related to Sustainability</h4>
                        <SustainabilityDealsTrendChart data={investmentTrendData} selectedCompany={selectedCompany} />
                      </section>
                    </section>
                  )}

                  {!isInvestmentInsightsLoading && !investmentInsights && (
                    <p className="commitment-section-message">No investment insight data available for this selection.</p>
                  )}
                </div>
              </article>
            </div>

            <div className="home-card-grid-one">
              <article
                className="card home-insight-card interactive-card"
                role="button"
                tabIndex={0}
                onClick={() => setActiveModal('kpi')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveModal('kpi')
                  }
                }}
              >
                <div className="card-heading-row">
                  <h3>KPI Momentum</h3>
                  <span className="card-see-more">See More</span>
                </div>
                <p className="card-subtitle">Performance signal strength across sustainability KPIs</p>
                <div className="gradient-line" />

                <div className="kpi-infographic-layout">
                  <section className="kpi-hero-section">
                    <div className="kpi-hero-main">
                      <strong>{kpiTrendSummary.improvingCount}/{kpiTrendSummary.total || 0}</strong>
                      <span>KPIs improving</span>
                    </div>
                    <div className="kpi-signal-row">
                      <span className="kpi-signal-chip improving">↑ Improving {kpiTrendSummary.improvingCount}</span>
                      <span className="kpi-signal-chip stable">→ Stable {kpiTrendSummary.stableCount}</span>
                      <span className="kpi-signal-chip risk">↓ At Risk {kpiTrendSummary.riskCount}</span>
                    </div>
                  </section>

                  <div className="kpi-infographic-grid">
                    {kpiInsights.metrics.map((metric) => {
                      const trend = (metric.trend || '').toLowerCase()
                      const trendClass = trend === 'improving' ? 'improving' : trend === 'stable' ? 'stable' : 'risk'
                      return (
                        <article key={metric.label} className={`kpi-infographic-item ${trendClass}`}>
                          <div className="kpi-item-header">
                            <p>{metric.label}</p>
                            <em className={`kpi-trend-tag ${trendClass}`}>{metric.trend}</em>
                          </div>
                          <strong>{metric.value}</strong>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}

        {activeView === 'scorecard' && (
          <section className="scorecard-page">
            <div className="settings-header">
              <h2>Commitment Scorecard</h2>
              <button type="button" className="btn-ghost" onClick={() => setActiveView('home')}>Back to Dashboard</button>
            </div>
            <p className="body-subtitle">Achieved + On-track distribution across sector players</p>

            <section className="card scorecard-chart-card">
              <h3 className="scorecard-chart-title">Commitment Progress benchmark</h3>
              <div className="scorecard-thin-divider" />
              {isCommitmentOverviewLoading && <p>Loading score distribution...</p>}
              {!isCommitmentOverviewLoading && !!(commitmentOverview?.ranking || []).length && (
                <div className="score-vertical-layout">
                  <CommitmentProgressChart ranking={commitmentOverview?.ranking || []} />

                  <aside className="score-segment-legend">
                    <h4>Legend</h4>
                    <div><i className="legend-block achieved" /> Achieved</div>
                    <div><i className="legend-block ontrack" /> On-Track</div>
                    <div><i className="legend-block offtrack" /> Off-Track</div>
                    <div><i className="legend-block noreporting" /> Not Reporting</div>
                    <div><i className="legend-block others" /> No-target</div>
                  </aside>
                </div>
              )}

              {!isCommitmentOverviewLoading && !(commitmentOverview?.ranking || []).length && <p>No score distribution data available.</p>}
            </section>

            <section className="card scorecard-table-card">
              <div className="scorecard-table-head">
                <h3>Scorecard</h3>
                <button type="button" className="btn-ghost" onClick={() => setActiveModal('methodology')}>Methodology</button>
              </div>
              <div className="gradient-line" />

              <div className="score-scale-legend">
                <div className="score-scale-legend-track">
                  <div className="status-scale-gradient" />
                  <div className="score-scale-legend-labels">
                    <span>X (No Commitments)</span>
                    <span>A (Active)</span>
                    <span>P (Proactive)</span>
                    <span>L (Leading)</span>
                    <span>D (Distinctive)</span>
                  </div>
                </div>
                <div className="score-scale-meta">
                  <span className="scale-marker-legend-item company"><i className="scale-marker-legend-line" />C = Client</span>
                  <span className="scale-marker-legend-item peer"><i className="scale-marker-legend-triangle up" />P = Peer Avg</span>
                  <span className="scale-marker-legend-item best"><i className="scale-marker-legend-triangle up" />B = Best</span>
                </div>
              </div>

              {isScorecardLoading && <p>Loading scorecard table...</p>}

              {!isScorecardLoading && scorecardData && (
                <div className="table-wrap scorecard-table-wrap">
                  <table className="scorecard-main-table">
                    <colgroup>
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '30%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Theme</th>
                        <th>Overall Status</th>
                        <th>Progress</th>
                        <th>Best Practices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scorecardData.rows || []).map((row) => {
                        const isExpanded = !!expandedScorecardThemes[row.theme]
                        const commitments = row.commitments || []

                        return (
                          <Fragment key={row.theme}>
                            <tr
                              className={`scorecard-theme-row ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => toggleScorecardThemeExpansion(row.theme)}
                            >
                              <td>
                                <div className="scorecard-theme-cell">
                                  <strong>{row.theme}</strong>
                                  <span className="theme-commitment-count">({row.commitmentCount || commitments.length} commitments)</span>
                                </div>
                              </td>
                              <td>
                                <div className="score-scale-cell-head">
                                  <button
                                    type="button"
                                    className="score-info-button"
                                    aria-label={`Open score rationale for ${row.theme}`}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setSelectedThemeRationale(row)
                                    }}
                                  >
                                    i
                                  </button>
                                </div>
                                <StatusScaleCell
                                  overallStatus={row.overallStatus}
                                  peerAverage={row.peerAverage}
                                  bestScore={row.bestScore}
                                />
                              </td>
                              <td>
                                <div className="scorecard-progress-cell">
                                  {(() => {
                                    const progressText = String(row.progress || 'Pending logic')
                                    const match = progressText.match(/^(\d+)\/(\d+)\s+(.*)$/)

                                    if (!match) {
                                      return <span>{progressText}</span>
                                    }

                                    const [, achievedCount, totalCount, suffix] = match
                                    return (
                                      <span className="progress-summary-text">
                                        <strong className="progress-ratio">
                                          <span>{achievedCount}</span>
                                          <span className="progress-ratio-slash"> / </span>
                                          <span>{totalCount}</span>
                                        </strong>{' '}
                                        <span>{suffix}</span>
                                      </span>
                                    )
                                  })()}
                                  {!!row.progressLabel && (
                                    <span className={`progress-pill ${getProgressLabelClass(row.progressLabel)}`}>
                                      {row.progressLabel}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <strong>{row.bestPlayer}</strong>
                                <p className="best-practice-text">{row.bestPractice}</p>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="scorecard-commitments-row">
                                <td colSpan={4}>
                                  <div className="scorecard-commitments-wrap">
                                    <table className="scorecard-commitments-table">
                                      <thead>
                                        <tr>
                                          <th>Commitment Name</th>
                                          <th>Status</th>
                                          <th>Peer numbers</th>
                                          <th>Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {commitments.map((commitment) => (
                                          <tr key={`${row.theme}-${commitment.name}`}>
                                            <td>{commitment.name}</td>
                                            <td>
                                              <span className={`commitment-status-pill ${getCommitmentStatusClass(commitment.status)}`}>
                                                {formatCommitmentStatus(commitment.status)}
                                              </span>
                                            </td>
                                            <td>{commitment.peerStatusSummary || 'No peer commitments mapped'}</td>
                                            <td>
                                              {!!(commitment.descriptionPoints || []).length && (
                                                <ul className="commitment-description-list">
                                                  {(commitment.descriptionPoints || []).map((point) => (
                                                    <li key={`${commitment.name}-${point}`}>{point}</li>
                                                  ))}
                                                </ul>
                                              )}
                                              {!(commitment.descriptionPoints || []).length && (
                                                <span className="commitment-description-empty">No additional details disclosed.</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                        {!commitments.length && (
                                          <tr>
                                            <td colSpan={4}>No commitments available for this theme.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!isScorecardLoading && !scorecardData && (
                <div className="scorecard-placeholder">
                  No scorecard data available for this sector/company.
                </div>
              )}
            </section>
          </section>
        )}

        {activeView === 'investments' && (
          <section className="scorecard-page">
            <div className="settings-header">
              <h2>Investment Deep Dive</h2>
              <button type="button" className="btn-ghost" onClick={() => setActiveView('home')}>Back to Dashboard</button>
            </div>
            <p className="body-subtitle">Topic and region positioning vs peers, plus multi-year investment + green capex trajectory</p>

            {isInvestmentInsightsLoading && (
              <section className="card scorecard-chart-card">
                <h3 className="scorecard-chart-title">Investment Charts</h3>
                <div className="scorecard-thin-divider" />
                <p>Loading investment charts...</p>
              </section>
            )}

            {!isInvestmentInsightsLoading && investmentInsights && (
              <>
                <div className="investment-chart-grid investment-chart-grid-two">
                  <InvestmentHeatmapChart
                    title="Sustainability Topic × Region"
                    timelineYears={investmentInsights.timeline?.years || []}
                    rowLabel="Sustainability Topic"
                    rowAccessor={(event) => String(event?.theme || '-').trim() || '-'}
                    columnAccessor={(event) => String(event?.region || 'Other').trim() || 'Other'}
                    onCellClick={setSelectedHeatmapCell}
                  />
                  <InvestmentDealHeatmapChart
                    title="Target Industry × Deal Type"
                    timelineYears={investmentInsights.timeline?.years || []}
                    onCellClick={setSelectedHeatmapCell}
                  />
                </div>

                <div className="investment-chart-grid investment-chart-grid-four">
                  <MixDistributionChart title="Sustainability Topic Mix" keys={investmentSustainabilityMix.keys} rows={investmentSustainabilityMix.rows} selectedCompany={selectedCompany} tall />
                  <MixDistributionChart title="Region Mix" keys={investmentRegionMix.keys} rows={investmentRegionMix.rows} selectedCompany={selectedCompany} tall />
                  <MixDistributionChart title="Target Industry Mix" keys={investmentTargetIndustryMix.keys} rows={investmentTargetIndustryMix.rows} selectedCompany={selectedCompany} tall />
                  <MixDistributionChart title="Deal Type Mix" keys={investmentDealTypeMix.keys} rows={investmentDealTypeMix.rows} selectedCompany={selectedCompany} tall />
                </div>
              </>
            )}

            {!isInvestmentInsightsLoading && !investmentInsights && (
              <section className="card scorecard-chart-card">
                <h3 className="scorecard-chart-title">Investment Charts</h3>
                <div className="scorecard-thin-divider" />
                <p>No investment insights available.</p>
              </section>
            )}

            <section className="card scorecard-table-card">
              <div className="scorecard-table-head">
                <h3>Investment & Green Capex Timeline</h3>
              </div>
              <div className="gradient-line" />

              {isInvestmentInsightsLoading && <p>Loading timeline...</p>}
              {!isInvestmentInsightsLoading && investmentInsights && (
                <div className="investment-timeline-wrap">
                  {(investmentInsights.timeline?.years || []).map((yearBlock) => (
                    <section key={yearBlock.year} className="timeline-year-column">
                      <header className="timeline-year-head">
                        <div className="timeline-year-head-top">
                          <h4>{yearBlock.year}</h4>
                          <span className="timeline-year-count-pill">{yearBlock.dealCount ?? (yearBlock.events || []).length} Deals</span>
                        </div>
                        <ul className="timeline-year-insight-list">
                          {((yearBlock.insightPoints || []).length
                            ? (yearBlock.insightPoints || [])
                            : [yearBlock.summary || 'No yearly strategy summary available.'])
                            .slice(0, 3)
                            .map((point, pointIndex) => (
                              <li key={`${yearBlock.year}-insight-${pointIndex}`}>{point}</li>
                            ))}
                        </ul>
                      </header>

                      <div className="timeline-event-list">
                        {(yearBlock.events || []).map((event, index) => (
                          <article
                            key={`${event.title}-${event.date}-${index}`}
                            className="timeline-event-card interactive-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTimelineEvent(event)}
                            onKeyDown={(keyboardEvent) => {
                              if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                                keyboardEvent.preventDefault()
                                setSelectedTimelineEvent(event)
                              }
                            }}
                          >
                            <span className={`timeline-source-chip ${event.source === 'Green Capex' ? 'capex' : 'deal'}`}>
                              {event.source}
                            </span>
                            <span className="timeline-dealtype-pill">{event.dealType || 'Other'}</span>
                            <h5>{event.title}</h5>
                            <p>{event.headline || (event.overviewPoints || [])[0] || 'No summary available.'}</p>
                            <div className="timeline-event-meta">
                              <span>Date: {event.date || 'NA'}</span>
                              <span>Theme: {event.theme || 'Unspecified theme'}</span>
                              <span>Region: {event.region || 'Other'}</span>
                              <span>Target Industry: {formatIndustryLabel(event.targetIndustry)}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                  {!(investmentInsights.timeline?.years || []).length && <p>No timeline data available.</p>}
                </div>
              )}
            </section>

            {selectedTimelineEvent && (
              <div className="modal-backdrop" onClick={() => setSelectedTimelineEvent(null)}>
                <div className="modal-card commitment-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{selectedTimelineEvent.title || 'Deal Details'}</h3>
                    <button type="button" className="btn-ghost" onClick={() => setSelectedTimelineEvent(null)}>Close</button>
                  </div>

                  <section className="modal-pane">
                    <h4>Overview</h4>
                    <ul className="modal-priority-list">
                      {((selectedTimelineEvent.overviewPoints || []).length
                        ? selectedTimelineEvent.overviewPoints
                        : [selectedTimelineEvent.headline || 'No detailed overview available.'])
                        .map((point, pointIndex) => (
                          <li key={`${selectedTimelineEvent.title || 'deal'}-overview-${pointIndex}`}>{point}</li>
                        ))}
                    </ul>
                  </section>

                  <section className="modal-pane">
                    <h4>Metadata Pills</h4>
                    <div className="timeline-event-meta">
                      <span>Source: {selectedTimelineEvent.source || 'Investment Deal'}</span>
                      <span>Date: {selectedTimelineEvent.date || 'NA'}</span>
                      <span>Theme: {selectedTimelineEvent.theme || 'Unspecified theme'}</span>
                      <span>Region: {selectedTimelineEvent.region || 'Other'}</span>
                      <span>Target Industry: {formatIndustryLabel(selectedTimelineEvent.targetIndustry)}</span>
                      <span>Transaction Value: {formatTransactionValue(selectedTimelineEvent.transactionValue)}</span>
                      <span>Deal Type: {selectedTimelineEvent.dealType || 'Other'}</span>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </section>
        )}

        {activeView === 'settings' && (
          <section className="card settings-card">
            <div className="settings-header">
              <h2>Settings</h2>
              <button type="button" className="btn-ghost" onClick={() => setActiveView('home')}>Close</button>
            </div>
            <div className="gradient-line" />

            <form className="settings-form" onSubmit={handleSaveProfile}>
              <label>First Name</label>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />

              <label>Last Name</label>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} required />

              <label>Email ID</label>
              <input value={user.email} disabled />

              <button type="submit" className="btn-primary">Save Profile</button>
            </form>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowChangePassword((value) => !value)}
            >
              Change Password
            </button>

            {showChangePassword && (
              <form className="settings-form password-form" onSubmit={handleSettingsPasswordChange}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={settingsCurrentPassword}
                  onChange={(event) => setSettingsCurrentPassword(event.target.value)}
                  required
                />

                <label>New Password</label>
                <input
                  type="password"
                  value={settingsNewPassword}
                  onChange={(event) => setSettingsNewPassword(event.target.value)}
                  required
                />

                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={settingsConfirmPassword}
                  onChange={(event) => setSettingsConfirmPassword(event.target.value)}
                  required
                />

                <button type="submit" className="btn-primary">Update Password</button>
              </form>
            )}
          </section>
        )}

        {activeView === 'users' && user.isAdmin && (
          <section className="card users-card">
            <div className="settings-header">
              <h2>Users</h2>
              <button type="button" className="btn-ghost" onClick={resetAdminForm}>New User</button>
            </div>
            <div className="gradient-line" />

            <form className="admin-user-form" onSubmit={handleAdminUserSubmit}>
              <div className="form-grid">
                <div>
                  <label>Email ID</label>
                  <input
                    type="email"
                    value={adminFormEmail}
                    disabled={!!editingUserId}
                    onChange={(event) => setAdminFormEmail(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>{editingUserId ? 'New Password (optional)' : 'Password'}</label>
                  <input
                    type="password"
                    value={adminFormPassword}
                    onChange={(event) => setAdminFormPassword(event.target.value)}
                  />
                </div>

                <div>
                  <label>First Name</label>
                  <input value={adminFormFirstName} onChange={(event) => setAdminFormFirstName(event.target.value)} required />
                </div>

                <div>
                  <label>Last Name</label>
                  <input value={adminFormLastName} onChange={(event) => setAdminFormLastName(event.target.value)} required />
                </div>
              </div>

              <div>
                <label>Assigned Sectors</label>
                <div className="sector-checkbox-grid">
                  {allSectors.map((sector) => (
                    <label key={sector} className="sector-checkbox">
                      <input
                        type="checkbox"
                        checked={adminFormSectors.includes(sector)}
                        onChange={() => toggleAdminSector(sector)}
                      />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="sector-checkbox inline-checkbox">
                <input
                  type="checkbox"
                  checked={adminFormIsAdmin}
                  onChange={(event) => setAdminFormIsAdmin(event.target.checked)}
                />
                <span>Admin access</span>
              </label>

              <div className="admin-form-actions">
                <button type="submit" className="btn-primary">{editingUserId ? 'Update User' : 'Add User'}</button>
                {editingUserId && <button type="button" className="btn-secondary" onClick={resetAdminForm}>Cancel Edit</button>}
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User ID (Email)</th>
                    <th>Password</th>
                    <th>Name</th>
                    <th>Added Sector(s)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.email}</td>
                      <td>{item.maskedPassword || '********'}</td>
                      <td>{item.firstName} {item.lastName}</td>
                      <td>{(item.sectors || []).join(', ') || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-ghost" onClick={() => handleEditUser(item)}>Edit</button>
                          <button type="button" className="btn-secondary" onClick={() => handleDeleteUser(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {activeModal === 'commitments' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card commitment-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Commitment Progress - {selectedCompany}</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <section className="modal-commitment-hero">
              <p>Execution Snapshot</p>
              {isCommitmentOverviewLoading && <p className="commitment-section-message">Loading commitment metrics...</p>}
              {!isCommitmentOverviewLoading && commitmentOverview && (
                <>
                  <div className="modal-commitment-stats">
                    <article>
                      <span>Total Commitments</span>
                      <strong>{commitmentOverview.totalCommitments}</strong>
                    </article>
                    <article className="positive">
                      <span>Achieved + On-track</span>
                      <strong>{commitmentOverview.achievedOnTrackPct}%</strong>
                    </article>
                    <article className="risk">
                      <span>Off-track</span>
                      <strong>{commitmentOverview.offTrackPct}%</strong>
                    </article>
                  </div>
                </>
              )}
              {!isCommitmentOverviewLoading && !commitmentOverview && (
                <p className="commitment-section-message">No commitment overview available.</p>
              )}
            </section>

            <div className="modal-two-column commitment-modal-grid">
              <section className="modal-pane commitment-pane-chart">
                <h4>Theme Score Snapshot</h4>
                {isScorecardLoading && <p>Loading theme comparison...</p>}
                {!isScorecardLoading && <ThemeSpiderChart data={scorecardData?.radarThemes || []} companyName={selectedCompany} />}
              </section>

              <section className="modal-pane commitment-pane-actions">
                <h4>Action Priorities</h4>
                <ul className="modal-priority-list">
                  {(scorecardData?.priorityMoves || []).map((move) => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
                {!isScorecardLoading && !(scorecardData?.priorityMoves || []).length && (
                  <p>No priority moves available.</p>
                )}
              </section>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setActiveModal(null)
                  setActiveView('scorecard')
                }}
              >
                Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'kpi' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card kpi-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>KPI Momentum - {selectedCompany}</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <section className="modal-kpi-hero">
              <div className="modal-kpi-hero-main">
                <strong>{kpiTrendSummary.improvingCount}/{kpiTrendSummary.total || 0}</strong>
                <span>KPIs improving</span>
              </div>
              <div className="kpi-signal-row">
                <span className="kpi-signal-chip improving">↑ Improving {kpiTrendSummary.improvingCount}</span>
                <span className="kpi-signal-chip stable">→ Stable {kpiTrendSummary.stableCount}</span>
                <span className="kpi-signal-chip risk">↓ At Risk {kpiTrendSummary.riskCount}</span>
              </div>
            </section>

            <div className="modal-kpi-grid">
              {kpiInsights.metrics.map((metric) => {
                const trend = (metric.trend || '').toLowerCase()
                const trendClass = trend === 'improving' ? 'improving' : trend === 'stable' ? 'stable' : 'risk'
                return (
                  <article key={metric.label} className={`modal-kpi-item ${trendClass}`}>
                    <div className="modal-kpi-item-head">
                      <span>{metric.label}</span>
                      <em className={`kpi-trend-tag ${trendClass}`}>{metric.trend}</em>
                    </div>
                    <strong>{metric.value}</strong>
                  </article>
                )
              })}
            </div>

            <section className="modal-pane">
              <h4>Suggested Focus Areas</h4>
              <ul className="modal-priority-list">
                {kpiInsights.moves.map((move) => (
                  <li key={move}>{move}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {activeModal === 'investment' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card commitment-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Investment Intelligence - {selectedCompany}</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <section className="modal-commitment-hero">
              <p>Capital Allocation Snapshot</p>
              {isInvestmentInsightsLoading && <p className="commitment-section-message">Loading investment metrics...</p>}
              {!isInvestmentInsightsLoading && investmentInsights && (
                <section className="investment-summary-band investment-summary-band-modal">
                  <article className="investment-stat-tile highlight">
                    <span>Total Deals</span>
                    <strong>{investmentInsights.summary?.dealCount || 0}</strong>
                  </article>
                  <article className="investment-stat-tile highlight">
                    <span>Green Capex Investments</span>
                    <strong>{investmentInsights.summary?.greenCapexCount || 0}</strong>
                  </article>
                  <article className="investment-stat-tile">
                    <span>Top Region</span>
                    <strong>{investmentInsights.summary?.topRegion || 'NA'}</strong>
                  </article>
                </section>
              )}
              {!isInvestmentInsightsLoading && !investmentInsights && (
                <p className="commitment-section-message">No investment snapshot available.</p>
              )}
            </section>

            {!isInvestmentInsightsLoading && investmentInsights && (
              <div className="investment-modal-grid">
                <div className="investment-chart-grid investment-chart-grid-two">
                  <InvestmentHeatmapChart
                    title="Sustainability Topic × Region Heatmap"
                    timelineYears={investmentInsights.timeline?.years || []}
                    rowLabel="Sustainability Topic"
                    rowAccessor={(event) => String(event?.theme || '-').trim() || '-'}
                    columnAccessor={(event) => String(event?.region || 'Other').trim() || 'Other'}
                    onCellClick={setSelectedHeatmapCell}
                  />
                  <InvestmentDealHeatmapChart
                    title="Target × Deal Type Heatmap"
                    timelineYears={investmentInsights.timeline?.years || []}
                    onCellClick={setSelectedHeatmapCell}
                  />
                </div>

                <div className="investment-chart-grid investment-chart-grid-two">
                  <section className="modal-pane investment-strategy-block tone-neutral">
                    <div className="investment-insight-header">
                      <h4>{selectedCompany} Insights</h4>
                      <span
                        className={`investment-insight-source ${(investmentInsights.narrative?.focusCompanyPithyMeta?.source || 'fallback') === 'ai' ? 'ai' : 'fallback'}`}
                      >
                        {(investmentInsights.narrative?.focusCompanyPithyMeta?.source || 'fallback') === 'ai' ? 'AI generated' : 'Fallback'}
                      </span>
                    </div>
                    <ul className="investment-simple-list">
                      {(investmentInsights.narrative?.focusCompanyPithyInsights || []).slice(0, 3).map((line, index) => (
                        <li key={`fc-insight-${index}`}>{line}</li>
                      ))}

                    {selectedHeatmapCell && (
                      <div className="modal-backdrop" onClick={() => setSelectedHeatmapCell(null)}>
                        <div className="modal-card commitment-modal heatmap-drilldown-modal" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-header">
                            <h3>{selectedHeatmapCell.title || 'Heatmap Drilldown'}</h3>
                            <button type="button" className="btn-ghost" onClick={() => setSelectedHeatmapCell(null)}>Close</button>
                          </div>

                          <section className="modal-pane">
                            <h4>{selectedHeatmapCell.rowLabel || 'Row'}: {selectedHeatmapCell.rowValue || '-'} • {selectedHeatmapCell.columnValue || '-'}</h4>
                            <div className="heatmap-drilldown-table-wrap">
                              <table className="heatmap-drilldown-table">
                                <thead>
                                  <tr>
                                    <th>Target Name</th>
                                    <th>Quick Overview</th>
                                    <th>Other Info</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selectedHeatmapCell.events || []).map((event, index) => {
                                    const quickOverview = String(
                                      event?.headline
                                      || (Array.isArray(event?.overviewPoints) ? event.overviewPoints[0] : '')
                                      || 'No summary available.',
                                    )
                                    return (
                                      <tr key={`${event?.title || 'event'}-${event?.date || 'na'}-${index}`}>
                                        <td>{event?.title || 'Unknown target'}</td>
                                        <td>{quickOverview}</td>
                                        <td>
                                          <div className="timeline-event-meta">
                                            <span>Source: {event?.source || 'Investment Deal'}</span>
                                            <span>Date: {event?.date || 'NA'}</span>
                                            <span>Theme: {event?.theme || 'Unspecified theme'}</span>
                                            <span>Region: {event?.region || 'Other'}</span>
                                            <span>Target Industry: {formatIndustryLabel(event?.targetIndustry)}</span>
                                            <span>Deal Type: {event?.dealType || 'Other'}</span>
                                            <span>Transaction Value: {formatTransactionValue(event?.transactionValue)}</span>
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        </div>
                      </div>
                    )}
                    </ul>
                  </section>

                  <section className="modal-pane investment-strategy-block tone-neutral">
                    <div className="investment-insight-header">
                      <h4>Peer Insights</h4>
                      <span
                        className={`investment-insight-source ${(investmentInsights.narrative?.peerPithyMeta?.source || 'fallback') === 'ai' ? 'ai' : 'fallback'}`}
                      >
                        {(investmentInsights.narrative?.peerPithyMeta?.source || 'fallback') === 'ai' ? 'AI generated' : 'Fallback'}
                      </span>
                    </div>
                    <ul className="investment-simple-list">
                      {((investmentInsights.narrative?.peerPithyInsights || []).length
                        ? investmentInsights.narrative.peerPithyInsights
                        : (investmentInsights.narrative?.peerInsights || [])
                      ).slice(0, 3).map((line, index) => (
                        <li key={`peer-insight-${index}`}>{line}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setActiveModal(null)
                  setActiveView('investments')
                }}
              >
                Open Investment Deep Dive
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'methodology' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Methodology Framework</h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Close</button>
            </div>

            <div className="methodology-grid">
              <section className="modal-pane methodology-card">
                <p className="method-step">Step 1</p>
                <h4>Bucket Classification</h4>
                <p>
                  Each theme is first evaluated on industry-specific scale definitions across 5 parameters:
                  Existence &amp; Specificity, Ambition, Coverage, Credibility &amp; Transparency, and Delivery / Status.
                </p>
                <div className="method-bucket-row">
                  {scorecardBucketLegend.map((item) => (
                    <span key={item.code} className="method-bucket-pill">{item.code} = {item.label}</span>
                  ))}
                </div>
              </section>

              <section className="modal-pane methodology-card">
                <p className="method-step">Step 2</p>
                <h4>Quantitative Positioning Within Bucket</h4>
                <p>
                  Once the bucket is identified, the theme’s overall score is added to bucket base score
                  to determine final score and relative position vs peers.
                </p>
                <ul className="modal-priority-list compact">
                  <li>Final score = Bucket base + Overall score</li>
                  <li>Bucket base: X=0, A=20, P=40, L=60, D=80</li>
                  <li>Status scale compares Client, Peer Avg, and Best player</li>
                </ul>
              </section>

              <section className="modal-pane methodology-card">
                <p className="method-step">Step 3</p>
                <h4>Progress Status Logic</h4>
                <p>
                  For each theme, progress = (Achieved + On-Track) / Total commitments. This percentage is compared
                  against peer average % for the same theme.
                </p>
                <div className="method-bucket-row">
                  <span className="progress-pill leading">Leading</span>
                  <span className="progress-pill atpar">At-Par</span>
                  <span className="progress-pill lagging">Lagging</span>
                </div>
              </section>

              <section className="modal-pane methodology-card">
                <h4>Industry Scale Example ({selectedSector})</h4>
                {!!scorecardData?.industryScaleExample && (
                  <>
                    <p className="methodology-mini-note">
                      Example parameter from {scorecardData.industryScaleExample.theme}: {scorecardData.industryScaleExample.parameter}
                    </p>
                    <div className="methodology-scale-table-wrap">
                      <table className="methodology-scale-table compact">
                        <thead>
                          <tr>
                            {['X', 'A', 'P', 'L', 'D'].map((code) => (
                              <th key={`method-example-${code}`}>{code} ({scorecardBucketLabelByCode[code] || code})</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {['X', 'A', 'P', 'L', 'D'].map((code) => (
                              <td key={`method-example-value-${code}`}>{scorecardData.industryScaleExample.buckets?.[code] || '—'}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {!scorecardData?.industryScaleExample && (
                  <p className="methodology-mini-note">Scale example not available for this industry in the uploaded file.</p>
                )}
                <p className="methodology-mini-note">
                  For theme-specific parameter scales, open each theme’s <strong>i</strong> icon in the scorecard table.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      {!!selectedThemeRationale && (
        <div className="modal-backdrop" onClick={() => setSelectedThemeRationale(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedThemeRationale.theme} - Score rationale</h3>
              <button type="button" className="btn-ghost" onClick={() => setSelectedThemeRationale(null)}>Close</button>
            </div>

            <div className="theme-modal-sections">
              <section className="modal-pane">
                <h4>Client score: {Number(selectedThemeRationale.overallStatus?.finalScore || 0).toFixed(1)}</h4>
                <h4>Score rationale</h4>
                <ul className="modal-priority-list">
                  {(selectedThemeRationale.rationalePoints || []).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>

              <section className="modal-pane">
                <h4>{selectedSector} | {selectedThemeRationale.theme} scale</h4>
                {!!(selectedThemeRationale.themeScale || []).length && (
                  <div className="methodology-scale-table-wrap">
                    <table className="methodology-scale-table compact">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          {['X', 'A', 'P', 'L', 'D'].map((code) => (
                            <th key={`theme-scale-head-${code}`}>{code}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedThemeRationale.themeScale || []).map((scaleRow) => (
                          <tr key={`${selectedThemeRationale.theme}-${scaleRow.parameter}`}>
                            <td>{scaleRow.parameter}</td>
                            {['X', 'A', 'P', 'L', 'D'].map((code) => (
                              <td key={`${selectedThemeRationale.theme}-${scaleRow.parameter}-${code}`}>
                                {scaleRow.buckets?.[code] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!(selectedThemeRationale.themeScale || []).length && (
                  <p className="methodology-mini-note">No industry/theme scale definition found in Commitment_Scale.xlsx for this theme.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
