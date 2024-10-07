import React from 'react'
import Link from 'next/link'
import styles from './powered-by.module.css'

const PoweredBy: React.FC = () => {
  return (
    <div className={styles.poweredByContainer}>
      <p className={styles.poweredByText}>
        Automated grammar correction application 
      </p>
      <div className={styles.poweredByLinks}>
        <Link
          href="https://upstash.com/docs/qstash/workflow/getstarted"
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.link} ${styles.linkUpstash}`}
        >
          Built using Upstash Workflow
        </Link>
        <span className={styles.dot}>•</span>
        <Link
          href="https://github.com/upstash/DegreeGuru"
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.link} ${styles.linkSource}`}
        >
          Source Code
        </Link>
      </div>
    </div>
  )
}

export default PoweredBy
