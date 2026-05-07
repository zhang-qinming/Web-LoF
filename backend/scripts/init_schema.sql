-- ============================================================
-- GWAS Data Browser — 新版数据库 Schema
-- 与旧表共存，通过环境变量 USE_NEW_SCHEMA 切换
-- ============================================================

-- Phase 0: 基础参照表
-- ============================================================

CREATE TABLE IF NOT EXISTS file_id_mapping (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gwas_id         VARCHAR(100) NOT NULL,
    lof_id          VARCHAR(100) NOT NULL,
    gwas_path       VARCHAR(500) NOT NULL,
    lof_path        VARCHAR(500) NOT NULL,
    UNIQUE KEY uk_gwas_lof (gwas_id, lof_id),
    INDEX idx_gwas (gwas_id),
    INDEX idx_lof (lof_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trait (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trait_name      VARCHAR(200) NOT NULL UNIQUE,
    trait_label     VARCHAR(500) DEFAULT NULL,
    description     TEXT         DEFAULT NULL,
    INDEX idx_trait_name (trait_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS file_metadata (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100) NOT NULL UNIQUE,
    trait_name      VARCHAR(200) NOT NULL,
    sample_size     INT UNSIGNED DEFAULT NULL,
    author          VARCHAR(500) DEFAULT NULL,
    pmid            VARCHAR(50)  DEFAULT NULL,
    year            SMALLINT     DEFAULT NULL,
    population      VARCHAR(200) DEFAULT NULL,
    n_case          DOUBLE       DEFAULT NULL,
    n_control       DOUBLE       DEFAULT NULL,
    has_gwas        BOOLEAN      DEFAULT FALSE,
    has_lof         BOOLEAN      DEFAULT FALSE,
    has_posterior   BOOLEAN      DEFAULT FALSE,
    has_regulation  BOOLEAN      DEFAULT FALSE,
    has_go          BOOLEAN      DEFAULT FALSE,
    has_program     BOOLEAN      DEFAULT FALSE,
    INDEX idx_trait (trait_name),
    INDEX idx_file_id (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_annotation (
    ensg_id         VARCHAR(15)  NOT NULL PRIMARY KEY,
    gene_symbol     VARCHAR(50)  NOT NULL,
    chr             VARCHAR(2)   NOT NULL,
    start_pos       INT UNSIGNED NOT NULL,
    end_pos         INT UNSIGNED NOT NULL,
    INDEX idx_symbol (gene_symbol),
    INDEX idx_chr_pos (chr, start_pos, end_pos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_set (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    geneset_name    VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_set_member (
    gene_set_id     INT UNSIGNED NOT NULL,
    ensg_id         VARCHAR(15)  NOT NULL,
    PRIMARY KEY (gene_set_id, ensg_id),
    FOREIGN KEY (gene_set_id) REFERENCES gene_set(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 1: 分析结果表
-- ============================================================

CREATE TABLE IF NOT EXISTS gwas_variant (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    chr             VARCHAR(2)    NOT NULL,
    bp              INT UNSIGNED  NOT NULL,
    rs_id           VARCHAR(50)   DEFAULT NULL,
    ea              VARCHAR(10)   DEFAULT NULL,
    nea             VARCHAR(10)   DEFAULT NULL,
    maf             DOUBLE        DEFAULT NULL,
    beta            DOUBLE        DEFAULT NULL,
    se              DOUBLE        DEFAULT NULL,
    p_value         DOUBLE        NOT NULL,
    zscore          DOUBLE        DEFAULT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    INDEX idx_file_chr_bp (file_id, chr, bp),
    INDEX idx_file_p (file_id, p_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lof_burden (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    ensg_id         VARCHAR(15)   NOT NULL,
    beta            DOUBLE        NOT NULL,
    se              DOUBLE        DEFAULT NULL,
    p_value         DOUBLE        NOT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    UNIQUE KEY uk_file_ensg (file_id, ensg_id),
    INDEX idx_file_p (file_id, p_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_posterior (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    ensg_id         VARCHAR(15)   NOT NULL,
    post_mean       DOUBLE        NOT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    UNIQUE KEY uk_file_ensg (file_id, ensg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_regulation (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    ensg_id         VARCHAR(15)   NOT NULL,
    beta_with_shet  DOUBLE        NOT NULL,
    p_with_shet     DOUBLE        NOT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    UNIQUE KEY uk_file_ensg (file_id, ensg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS go_enrichment (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    go_term_id      VARCHAR(20)   NOT NULL,
    go_term_name    VARCHAR(500)  NOT NULL,
    enrichment_type ENUM('gwas','lof') NOT NULL,
    p_value         DOUBLE        NOT NULL,
    odds_ratio      DOUBLE        DEFAULT NULL,
    n_overlap       INT           DEFAULT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    UNIQUE KEY uk_file_go_type (file_id, go_term_id, enrichment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 2: cNMF Program 数据
-- ============================================================

CREATE TABLE IF NOT EXISTS cnmf_program (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_name    VARCHAR(100) NOT NULL UNIQUE,
    k_value         SMALLINT     DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cnmf_spectra (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id      INT UNSIGNED  NOT NULL,
    ensg_id         VARCHAR(15)   NOT NULL,
    weight          DOUBLE        NOT NULL,
    FOREIGN KEY (program_id) REFERENCES cnmf_program(id) ON DELETE CASCADE,
    UNIQUE KEY uk_prog_ensg (program_id, ensg_id),
    INDEX idx_prog_weight (program_id, weight DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_enrichment (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    program_id      INT UNSIGNED  NOT NULL,
    mean_gamma      DOUBLE        NOT NULL,
    p_value         DOUBLE        NOT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES cnmf_program(id) ON DELETE CASCADE,
    UNIQUE KEY uk_file_prog (file_id, program_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS regulator_enrichment (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100)  NOT NULL,
    program_id      INT UNSIGNED  NOT NULL,
    regulator       VARCHAR(100)  NOT NULL,
    beta            DOUBLE        NOT NULL,
    p_value         DOUBLE        NOT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES cnmf_program(id) ON DELETE CASCADE,
    UNIQUE KEY uk_file_prog_reg (file_id, program_id, regulator)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS perturb_effect (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id      INT UNSIGNED  NOT NULL,
    ensg_id         VARCHAR(15)   NOT NULL,
    lm_es           DOUBLE        NOT NULL,
    lm_p            DOUBLE        NOT NULL,
    FOREIGN KEY (program_id) REFERENCES cnmf_program(id) ON DELETE CASCADE,
    UNIQUE KEY uk_prog_ensg (program_id, ensg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trans_eqtl (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id      INT UNSIGNED  NOT NULL UNIQUE,
    mean_z_gwas     DOUBLE        NOT NULL,
    mean_z_ctrl     DOUBLE        NOT NULL,
    ttest_p         DOUBLE        NOT NULL,
    FOREIGN KEY (program_id) REFERENCES cnmf_program(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
