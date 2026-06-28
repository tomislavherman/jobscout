CREATE TABLE IF NOT EXISTS users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_id       BIGINT NOT NULL,
    external_id     VARCHAR(255) NOT NULL,
    url             TEXT,
    role            VARCHAR(255),
    company         VARCHAR(255),
    location        TEXT,
    remote_type     VARCHAR(50),
    residency       VARCHAR(100),
    employment_type VARCHAR(50),
    salary          TEXT,
    raw_text        TEXT,
    status          VARCHAR(50) DEFAULT 'new',
    published_at    TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_source_external (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS timeline_entries (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id      BIGINT NOT NULL,
    user_id     BIGINT NULL,
    entry_type  VARCHAR(50) NOT NULL,
    status_from VARCHAR(50),
    status_to   VARCHAR(50),
    title       VARCHAR(255),
    content     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_id    BIGINT NOT NULL,
    started_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    status       VARCHAR(50) DEFAULT 'running',
    jobs_found   INT DEFAULT 0,
    jobs_new     INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_jobs (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    job_id     BIGINT NOT NULL,
    status     VARCHAR(50) NOT NULL DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_job (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS user_source_settings (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    source_id   BIGINT NOT NULL,
    enabled     TINYINT(1) NOT NULL DEFAULT 1,
    max_age_days INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_source (user_id, source_id)
);

CREATE TABLE IF NOT EXISTS source_requests (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT NULL,
    url        VARCHAR(500) NOT NULL,
    note       TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS source_settings (
    source_id       BIGINT PRIMARY KEY,
    sync_batch_size INT NULL
);
