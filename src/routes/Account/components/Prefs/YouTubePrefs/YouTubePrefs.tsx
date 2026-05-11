import React, { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import Icon from 'components/Icon'
import { setPref } from 'store/modules/prefs'
import styles from './YouTubePrefs.css'
import HttpApi from 'lib/HttpApi'

const api = new HttpApi('prefs')

interface TestResult {
  success: boolean
  message: string
}

interface YtDlOption {
  key: string
  value: string | boolean
}

const YouTubePrefs = () => {
  const dispatch = useAppDispatch()
  const [isExpanded, setExpanded] = useState(false)

  const isYouTubeEnabled = useAppSelector(state => (state.prefs as any).isYouTubeEnabled)
  const isKaraokeGeneratorEnabled = useAppSelector(state => (state.prefs as any).isKaraokeGeneratorEnabled)
  const isConcurrentAlignmentEnabled = useAppSelector(state => (state.prefs as any).isConcurrentAlignmentEnabled)
  const spleeterPath = useAppSelector(state => (state.prefs as any).spleeterPath) as string
  const autoLyrixHost = useAppSelector(state => (state.prefs as any).autoLyrixHost) as string
  const ffmpegPath = useAppSelector(state => (state.prefs as any).ffmpegPath) as string
  const youtubeDlExecOptions = useAppSelector(state => (state.prefs as any).youtubeDlExecOptions) as YtDlOption[]
  const tmpOutputPath = useAppSelector(state => (state.prefs as any).tmpOutputPath) as string
  const upcomingLyricsColor = useAppSelector(state => (state.prefs as any).upcomingLyricsColor) as string
  const playedLyricsColor = useAppSelector(state => (state.prefs as any).playedLyricsColor) as string
  const maxYouTubeProcesses = useAppSelector(state => (state.prefs as any).maxYouTubeProcesses) as number

  const [testingSpleeter, setTestingSpleeter] = useState(false)
  const [spleeterResult, setSpleeterResult] = useState<TestResult | null>(null)
  const [testingAutoLyrix, setTestingAutoLyrix] = useState(false)
  const [autoLyrixResult, setAutoLyrixResult] = useState<TestResult | null>(null)
  const [testingFfmpeg, setTestingFfmpeg] = useState(false)
  const [ffmpegResult, setFfmpegResult] = useState<TestResult | null>(null)

  const [newOptionKey, setNewOptionKey] = useState('')
  const [newOptionValue, setNewOptionValue] = useState('')
  const [newOptionType, setNewOptionType] = useState('string')
  const [isAddFormVisible, setIsAddFormVisible] = useState(false)

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  const toggleCheckbox = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPref({ key: e.target.name, data: e.target.checked }))
  }, [dispatch])

  const updateTextbox = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPref({ key: e.target.name, data: e.target.value }))
  }, [dispatch])

  const testSpleeter = () => {
    setTestingSpleeter(true)
    setSpleeterResult(null)
    api.get('/testspleeter')
      .then((response) => { setTestingSpleeter(false); setSpleeterResult(response as unknown as TestResult) })
      .catch((err) => { setTestingSpleeter(false); setSpleeterResult({ success: false, message: err.message }) })
  }

  const testAutoLyrix = () => {
    setTestingAutoLyrix(true)
    setAutoLyrixResult(null)
    api.get('/testautolyrix')
      .then((response) => { setTestingAutoLyrix(false); setAutoLyrixResult(response as unknown as TestResult) })
      .catch((err) => { setTestingAutoLyrix(false); setAutoLyrixResult({ success: false, message: err.message }) })
  }

  const testFfmpeg = () => {
    setTestingFfmpeg(true)
    setFfmpegResult(null)
    api.get('/testffmpeg')
      .then((response) => { setTestingFfmpeg(false); setFfmpegResult(response as unknown as TestResult) })
      .catch((err) => { setTestingFfmpeg(false); setFfmpegResult({ success: false, message: err.message }) })
  }

  const addOption = useCallback(() => {
    if (!newOptionKey.trim()) return
    const newOptions = [...youtubeDlExecOptions]
    newOptions.push({
      key: newOptionKey.trim(),
      value: newOptionType === 'boolean' ? newOptionValue === 'true' : newOptionValue,
    })
    dispatch(setPref({ key: 'youtubeDlExecOptions', data: newOptions }))
    setNewOptionKey('')
    setNewOptionValue('')
    setNewOptionType('string')
    setIsAddFormVisible(false)
  }, [dispatch, newOptionKey, newOptionValue, newOptionType, youtubeDlExecOptions])

  const removeOption = useCallback((indexToRemove: number) => {
    const newOptions = youtubeDlExecOptions.filter((_: YtDlOption, index: number) => index !== indexToRemove)
    dispatch(setPref({ key: 'youtubeDlExecOptions', data: newOptions }))
  }, [dispatch, youtubeDlExecOptions])

  const cancelAddOption = useCallback(() => {
    setNewOptionKey('')
    setNewOptionValue('')
    setNewOptionType('string')
    setIsAddFormVisible(false)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.heading} onClick={toggleExpanded}>
        <Icon icon='YOUTUBE' size={28} className={styles.icon} />
        <div className={styles.title}>YouTube</div>
        <div>
          <Icon icon={isExpanded ? 'CHEVRON_DOWN' : 'CHEVRON_RIGHT'} size={24} className={styles.icon} />
        </div>
      </div>

      <div style={{ display: isExpanded ? 'block' : 'none' }}>
        <div className={styles.content}>
          <label>
            <input type='checkbox' checked={isYouTubeEnabled} onChange={toggleCheckbox} name='isYouTubeEnabled' />
            {' '}Enable YouTube search
          </label>
        </div>

        <div className={styles.content} style={{ display: isYouTubeEnabled ? 'block' : 'none' }}>
          <label>
            Path to FFMPEG
            <input type='text' defaultValue={ffmpegPath} onChange={updateTextbox} name='ffmpegPath' />
            <div className={styles.tip}>
              If ffmpeg is available in your global PATH, this can be left as-is.
              Otherwise, enter the full path to the ffmpeg executable.
            </div>
          </label>
          {!testingFfmpeg && <a onClick={testFfmpeg}>Test FFMPEG</a>}
          {testingFfmpeg && <div>Testing FFMPEG...</div>}
          {ffmpegResult !== null && ffmpegResult.success && <div className={styles.testSuccess}>{ffmpegResult.message}</div>}
          {ffmpegResult !== null && !ffmpegResult.success && <div className={styles.testFailed}>{ffmpegResult.message}</div>}
        </div>

        <div className={styles.content} style={{ display: isYouTubeEnabled ? 'block' : 'none' }}>
          <label>
            Youtube-dl-exec Options
            <div className={styles.tip}>
              Pass additional options to youtube-dl-exec when downloading videos.
              Only string and boolean options are supported.
              <br /><a href='https://github.com/microlinkhq/youtube-dl-exec/tree/master?tab=readme-ov-file#usage'
                 target='_blank' rel='noreferrer'>More info</a>.
            </div>
          </label>

          <div className={styles.youtubeDlOptionsSection}>
            <div className={styles.optionsContainer}>
              {youtubeDlExecOptions?.length > 0 && (
                <ul className={styles.optionsList}>
                  {youtubeDlExecOptions.map((option: YtDlOption, index: number) => (
                    <li key={index} className={styles.optionItem}>
                      <code>{option.key}: {typeof option.value === 'boolean' ? option.value.toString() : option.value}</code>
                      <Icon icon='DELETE' size={18} className={styles.icon}
                        onClick={() => removeOption(index)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!isAddFormVisible && (
              <div className={styles.addOptionButtonContainer}>
                <button type='button' onClick={() => setIsAddFormVisible(true)} className={styles.addOptionButton}>
                  + Add New Option
                </button>
              </div>
            )}

            {isAddFormVisible && (
              <div className={styles.addOptionForm}>
                <input type='text' placeholder='Option key' value={newOptionKey}
                  onChange={(e) => setNewOptionKey(e.target.value)} className={styles.optionInput} />
                <select value={newOptionType} onChange={(e) => setNewOptionType(e.target.value)} className={styles.optionTypeSelect}>
                  <option value='string'>String</option>
                  <option value='boolean'>Boolean</option>
                </select>
                =
                {newOptionType === 'boolean'
                  ? <select value={newOptionValue} onChange={(e) => setNewOptionValue(e.target.value)} className={styles.optionValue}>
                      <option value='true'>true</option>
                      <option value='false'>false</option>
                    </select>
                  : <input type='text' placeholder='Option value' value={newOptionValue}
                      onChange={(e) => setNewOptionValue(e.target.value)} className={styles.optionValue} />
                }
                <div className={styles.formButtons}>
                  <button type='button' onClick={addOption} className={styles.addButton} disabled={!newOptionKey.trim()}>Add</button>
                  <button type='button' onClick={cancelAddOption} className={styles.cancelButton}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.content} style={{ display: isYouTubeEnabled ? 'block' : 'none' }}>
          <label>
            <input type='checkbox' checked={isKaraokeGeneratorEnabled} onChange={toggleCheckbox} name='isKaraokeGeneratorEnabled' />
            {' '}Automatically create karaoke mixes
            <div className={styles.tip}>
              If checked, users can search for anything on YouTube and we&apos;ll
              use spleeter and AutoLyrixAlignService to create a karaoke mix out of it.
              If unchecked, users can only search for pre-made karaoke songs on YouTube.
            </div>
          </label>
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            Path to Spleeter
            <input type='text' defaultValue={spleeterPath} onChange={updateTextbox} name='spleeterPath' />
            <div className={styles.tip}>
              If spleeter is available in your global PATH, this can be left as-is.
              Otherwise, enter the full path to the spleeter executable.
            </div>
          </label>
          {!testingSpleeter && <a onClick={testSpleeter}>Test Spleeter</a>}
          {testingSpleeter && <div>Testing Spleeter...</div>}
          {spleeterResult !== null && spleeterResult.success && <div className={styles.testSuccess}>{spleeterResult.message}</div>}
          {spleeterResult !== null && !spleeterResult.success && <div className={styles.testFailed}>{spleeterResult.message}</div>}
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            AutoLyrixAlign Service Host
            <input type='text' defaultValue={autoLyrixHost} onChange={updateTextbox} name='autoLyrixHost' />
            <div className={styles.tip}>
              The host and port where AutoLyrixAlign Service is listening.
              If installed locally, this will be localhost:3000.
            </div>
          </label>
          {!testingAutoLyrix && <a onClick={testAutoLyrix}>Test AutoLyrixAlign Service</a>}
          {testingAutoLyrix && <div>Testing AutoLyrixAlign Service...</div>}
          {autoLyrixResult !== null && autoLyrixResult.success && <div className={styles.testSuccess}>{autoLyrixResult.message}</div>}
          {autoLyrixResult !== null && !autoLyrixResult.success && <div className={styles.testFailed}>{autoLyrixResult.message}</div>}
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            <input type='checkbox' checked={isConcurrentAlignmentEnabled} onChange={toggleCheckbox} name='isConcurrentAlignmentEnabled' />
            {' '}Align lyrics concurrently
            <div className={styles.tip}>
              If checked, we&apos;ll run both spleeter and AutoLyricsAlign at the same time.
              This saves a lot of time, but might overwhelm your computer if AutoLyrixAlign Service is running locally.
            </div>
          </label>
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            Upcoming Lyrics Color
            <input type='text' defaultValue={upcomingLyricsColor} onChange={updateTextbox} name='upcomingLyricsColor' />
            <div className={styles.tip}>The color of lyrics that haven&apos;t been sang yet. Use any CSS color value.</div>
          </label>
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            Played Lyrics Color
            <input type='text' defaultValue={playedLyricsColor} onChange={updateTextbox} name='playedLyricsColor' />
            <div className={styles.tip}>Lyrics will change to this color as they are sang. Use any CSS color value.</div>
          </label>
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            Temporary output folder
            <input type='text' defaultValue={tmpOutputPath} onChange={updateTextbox} name='tmpOutputPath' />
            <div className={styles.tip}>
              This is where we&apos;ll store downloaded YouTube videos and cache vocal and instrumental tracks.
            </div>
          </label>
        </div>

        <div className={styles.content} style={{ display: (isKaraokeGeneratorEnabled && isYouTubeEnabled) ? 'block' : 'none' }}>
          <label>
            Maximum processing threads
            <input type='number' defaultValue={maxYouTubeProcesses} onChange={updateTextbox} name='maxYouTubeProcesses' />
            <div className={styles.tip}>
              Creating karaoke mixes is CPU intensive and can take several minutes per-song.
              Try setting this to around half the number of cores your CPU has.
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}

export default YouTubePrefs
