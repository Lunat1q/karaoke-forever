import React from 'react'
import Panel from 'components/Panel/Panel'
import AccountPrefs from './AccountPrefs'
import PathPrefs from './PathPrefs/PathPrefs'
import PlayerPrefs from './PlayerPrefs/PlayerPrefs'
import YouTubePrefs from './YouTubePrefs'
import styles from './Prefs.css'

const Prefs = () => (
  <Panel title='Preferences' contentClassName={styles.content}>
    <>
      <AccountPrefs />
      <PathPrefs />
      <PlayerPrefs />
      <YouTubePrefs />
    </>
  </Panel>
)

export default Prefs
