import React, { useMemo, useRef } from 'react'
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window'
import styles from './PaddedList.css'

interface PaddedExtra {
  _numRows: number
  _RowComponent: React.ComponentType<RowComponentProps>
  _paddingRight?: number
}

const PaddedRowComponent = ({ index, style, ariaAttributes, _numRows, _RowComponent: RowComponent, _paddingRight, ...rest }: RowComponentProps & PaddedExtra) => {
  if (index === 0 || index === _numRows + 1) {
    return <div key={index === 0 ? 'top' : 'bottom'} style={style} />
  }
  return <RowComponent index={index - 1} style={{ ...style, paddingRight: _paddingRight }} ariaAttributes={ariaAttributes} {...rest} />
}

interface PaddedListProps {
  numRows: number
  onRowsRendered?: (visibleRows: {
    startIndex: number
    stopIndex: number
  }, allRows: {
      startIndex: number
      stopIndex: number
    }) => void
  onRef?(ref: ListImperativeAPI | null): void
  paddingTop: number
  paddingRight?: number
  paddingBottom: number
  rowComponent: React.ComponentType<RowComponentProps>
  rowHeight(index: number): number
  rowProps?: Partial<RowComponentProps> & Record<string, unknown>
  width?: number
  height: number
}

const PaddedList = ({
  numRows,
  onRowsRendered,
  onRef,
  paddingTop,
  paddingRight,
  paddingBottom,
  rowComponent: RowComponent,
  rowHeight,
  rowProps = {},
  width,
  height,
}: PaddedListProps) => {
  const handleListRef = (ref: ListImperativeAPI | null) => {
    if (onRef) onRef(ref)
  }

  // Use refs so getRowHeight has a stable identity across renders
  const paddingTopRef = useRef(paddingTop)
  const paddingBottomRef = useRef(paddingBottom)
  const numRowsRef = useRef(numRows)
  const rowHeightRef = useRef(rowHeight)
  paddingTopRef.current = paddingTop
  paddingBottomRef.current = paddingBottom
  numRowsRef.current = numRows
  rowHeightRef.current = rowHeight

  const getRowHeightRef = useRef((index: number) => {
    if (index === 0) return paddingTopRef.current
    if (index === numRowsRef.current + 1) return paddingBottomRef.current
    return rowHeightRef.current(index - 1)
  })

  const mergedRowProps = useMemo(() => ({
    ...rowProps,
    _numRows: numRows,
    _RowComponent: RowComponent,
    _paddingRight: paddingRight,
  }), [rowProps, numRows, RowComponent, paddingRight])

  return (
    <List
      rowProps={mergedRowProps}
      rowComponent={PaddedRowComponent}
      rowCount={numRows + 2} // top & bottom spacer
      rowHeight={getRowHeightRef.current}
      onRowsRendered={onRowsRendered}
      overscanCount={10}
      listRef={handleListRef}
      className={styles.container}
      style={{ width, height }}
    />
  )
}

export default PaddedList
