-- ============================================================
-- GWAS Data Browser — Active schema used by current deployment
-- Keep only the tables that exist in the current MySQL database,
-- plus trait_ldsc for LDSC result ingestion.
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

CREATE TABLE IF NOT EXISTS file_metadata (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100) NOT NULL UNIQUE,
    gwas_id         VARCHAR(100) DEFAULT NULL,
    trait_name      VARCHAR(500) DEFAULT NULL,
    INDEX idx_trait (trait_name),
    INDEX idx_gwas (gwas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trait_ldsc (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gwas_id             VARCHAR(100) NOT NULL,
    file_id             VARCHAR(100) DEFAULT NULL,
    lof_id              VARCHAR(200) DEFAULT NULL,
    source_file         VARCHAR(255) DEFAULT NULL,
    enrichment          DOUBLE       DEFAULT NULL,
    enrichment_p        DOUBLE       DEFAULT NULL,
    coefficient_z_score DOUBLE       DEFAULT NULL,
    imported_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_trait_ldsc_gwas (gwas_id),
    INDEX idx_trait_ldsc_file (file_id),
    INDEX idx_trait_ldsc_lof (lof_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gwas_meta (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100) DEFAULT NULL,
    gwas_id         VARCHAR(100) NOT NULL UNIQUE,
    trait           VARCHAR(500) DEFAULT NULL,
    mesh_term       VARCHAR(500) DEFAULT NULL,
    mesh_id         VARCHAR(50)  DEFAULT NULL,
    sample_size     INT UNSIGNED DEFAULT NULL,
    n_case          DOUBLE       DEFAULT NULL,
    n_control       DOUBLE       DEFAULT NULL,
    population      VARCHAR(200) DEFAULT NULL,
    first_author    VARCHAR(200) DEFAULT NULL,
    pmid            VARCHAR(50)  DEFAULT NULL,
    year            SMALLINT     DEFAULT NULL,
    n_variants      INT UNSIGNED DEFAULT NULL,
    n_sig           INT UNSIGNED DEFAULT NULL,
    qc_score        INT          DEFAULT NULL,
    if_ukb          BOOLEAN      DEFAULT FALSE,
    collect_date    VARCHAR(20)  DEFAULT NULL,
    url             VARCHAR(500) DEFAULT NULL,
    file_path       VARCHAR(500) DEFAULT NULL,
    mesh_source     VARCHAR(100) DEFAULT NULL,
    source_batch    VARCHAR(20)  DEFAULT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE SET NULL,
    INDEX idx_file (file_id),
    INDEX idx_trait (trait),
    INDEX idx_batch (source_batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lof_meta (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100) DEFAULT NULL,
    burden_phenotype_id VARCHAR(200) NOT NULL UNIQUE,
    trait_id        VARCHAR(100) NOT NULL,
    trait_name      VARCHAR(500) DEFAULT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE SET NULL,
    INDEX idx_lof_meta_trait (trait_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_info (
    id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program                   VARCHAR(10)  NOT NULL UNIQUE,
    curated_annotation        VARCHAR(500) DEFAULT NULL,
    top10_genes               TEXT         DEFAULT NULL,
    top10_pathways            TEXT         DEFAULT NULL,
    representative_go         VARCHAR(500) DEFAULT NULL,
    go_term                   VARCHAR(500) DEFAULT NULL,
    go_accession              VARCHAR(20)  DEFAULT NULL,
    go_ontology               VARCHAR(100) DEFAULT NULL,
    go_enrichment_p           VARCHAR(50)  DEFAULT NULL,
    top10_chip_tf             TEXT         DEFAULT NULL,
    representative_tf         VARCHAR(200) DEFAULT NULL,
    representative_tf_kd_z    DOUBLE       DEFAULT NULL,
    representative_tf_p       VARCHAR(50)  DEFAULT NULL,
    representative_tf_class   VARCHAR(100) DEFAULT NULL,
    marker_coexpression       TEXT         DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_info_hg37_matched (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    perturb_symbol      VARCHAR(100) NOT NULL,
    chromosome          VARCHAR(50)  DEFAULT NULL,
    begin_pos           BIGINT       DEFAULT NULL,
    end_pos             BIGINT       DEFAULT NULL,
    symbol              VARCHAR(100) DEFAULT NULL,
    gene_name           VARCHAR(255) DEFAULT NULL,
    gene_id             VARCHAR(50)  DEFAULT NULL,
    gene_type           VARCHAR(100) DEFAULT NULL,
    synonyms            TEXT         DEFAULT NULL,
    hgnc                VARCHAR(50)  DEFAULT NULL,
    ensembl             VARCHAR(30)  DEFAULT NULL,
    description         TEXT         DEFAULT NULL,
    perturb_tested      BOOLEAN      NOT NULL DEFAULT TRUE,
    tested_program_count INT UNSIGNED NOT NULL DEFAULT 0,
    mapping_status      VARCHAR(50)  NOT NULL,
    annotation_source   VARCHAR(255) NOT NULL,
    imported_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gih37m_perturb_symbol (perturb_symbol),
    INDEX idx_gih37m_symbol (symbol),
    INDEX idx_gih37m_ensembl (ensembl),
    INDEX idx_gih37m_gene_id (gene_id),
    INDEX idx_gih37m_gene_type (gene_type),
    INDEX idx_gih37m_hgnc (hgnc),
    INDEX idx_gih37m_chromosome (chromosome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_program_trait_edge (
    id                         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    edge_key                   VARCHAR(320) NOT NULL,
    file_id                    VARCHAR(100) NOT NULL,
    trait_id                   VARCHAR(100) NOT NULL,
    program                    VARCHAR(100) NOT NULL,
    role                       ENUM('program','regulator') NOT NULL,
    side                       VARCHAR(50)  DEFAULT NULL,
    ensg_id                    VARCHAR(30)  DEFAULT NULL,
    gene_symbol                VARCHAR(100) DEFAULT NULL,
    gene_label                 VARCHAR(120) DEFAULT NULL,
    program_label              VARCHAR(300) DEFAULT NULL,
    program_annotation         VARCHAR(500) DEFAULT NULL,
    post_mean                  DOUBLE       DEFAULT NULL,
    abs_gamma                  DOUBLE       DEFAULT NULL,
    gamma_sign                 VARCHAR(50)  DEFAULT NULL,
    membership_score           DOUBLE       DEFAULT NULL,
    rank_within_side           INT          DEFAULT NULL,
    program_trait_sign         VARCHAR(50)  DEFAULT NULL,
    regulator_program_sign     VARCHAR(50)  DEFAULT NULL,
    predicted_sign             VARCHAR(50)  DEFAULT NULL,
    post_mean_sign             VARCHAR(50)  DEFAULT NULL,
    is_concordant              BOOLEAN      DEFAULT FALSE,
    is_discordant              BOOLEAN      DEFAULT FALSE,
    display_bucket             VARCHAR(100) DEFAULT NULL,
    display_bucket_label       VARCHAR(200) DEFAULT NULL,
    has_overlap                BOOLEAN      DEFAULT TRUE,
    source_file                VARCHAR(255) DEFAULT NULL,
    imported_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gene_program_trait_edge_key (edge_key),
    INDEX idx_gpte_gene (gene_symbol),
    INDEX idx_gpte_ensg (ensg_id),
    INDEX idx_gpte_program (program),
    INDEX idx_gpte_trait (trait_id),
    INDEX idx_gpte_file (file_id),
    INDEX idx_gpte_gene_program (gene_symbol, program),
    INDEX idx_gpte_ensg_program (ensg_id, program),
    INDEX idx_gpte_program_trait (program, trait_id),
    INDEX idx_gpte_trait_program (trait_id, program)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_gene_role_edge (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    edge_key        VARCHAR(360) NOT NULL,
    program         VARCHAR(100) NOT NULL,
    gene_symbol     VARCHAR(100) DEFAULT NULL,
    ensg_id         VARCHAR(30)  DEFAULT NULL,
    role            ENUM('program_gene','regulator') NOT NULL,
    score           DOUBLE       DEFAULT NULL,
    rank_value      INT          DEFAULT NULL,
    direction       VARCHAR(50)  DEFAULT NULL,
    source_dataset  VARCHAR(100) NOT NULL,
    source_file     VARCHAR(255) DEFAULT NULL,
    imported_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_program_gene_role_edge_key (edge_key),
    INDEX idx_pgre_program (program),
    INDEX idx_pgre_gene (gene_symbol),
    INDEX idx_pgre_ensg (ensg_id),
    INDEX idx_pgre_role (role),
    INDEX idx_pgre_program_role (program, role, rank_value),
    INDEX idx_pgre_gene_program (gene_symbol, program),
    INDEX idx_pgre_ensg_program (ensg_id, program)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_trait_scatter_edge (
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    edge_key         VARCHAR(360) NOT NULL,
    file_id          VARCHAR(100) NOT NULL,
    trait_id         VARCHAR(100) NOT NULL,
    program          VARCHAR(100) NOT NULL,
    program_score    DOUBLE       DEFAULT NULL,
    regulator_score  DOUBLE       DEFAULT NULL,
    program_p        DOUBLE       DEFAULT NULL,
    regulator_p      DOUBLE       DEFAULT NULL,
    program_rank     INT          DEFAULT NULL,
    regulator_rank   INT          DEFAULT NULL,
    program_gamma    DOUBLE       DEFAULT NULL,
    regulator_beta   DOUBLE       DEFAULT NULL,
    enrichment_class VARCHAR(50)  DEFAULT NULL,
    source_file      VARCHAR(255) DEFAULT NULL,
    imported_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_program_trait_scatter_edge_key (edge_key),
    INDEX idx_ptse_program (program),
    INDEX idx_ptse_trait (trait_id),
    INDEX idx_ptse_file (file_id),
    INDEX idx_ptse_program_trait (program, trait_id),
    INDEX idx_ptse_trait_program (trait_id, program)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gene_summary (
    gene_key                   VARCHAR(120) NOT NULL,
    gene_symbol                VARCHAR(100) DEFAULT NULL,
    ensg_id                    VARCHAR(30)  DEFAULT NULL,
    gene_label                 VARCHAR(120) DEFAULT NULL,
    chromosome                 VARCHAR(50)  DEFAULT NULL,
    begin_pos                  BIGINT       DEFAULT NULL,
    end_pos                    BIGINT       DEFAULT NULL,
    gene_name                  VARCHAR(255) DEFAULT NULL,
    gene_type                  VARCHAR(100) DEFAULT NULL,
    total_rows                 BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_programs             INT UNSIGNED    NOT NULL DEFAULT 0,
    total_traits               INT UNSIGNED    NOT NULL DEFAULT 0,
    program_role_rows          BIGINT UNSIGNED NOT NULL DEFAULT 0,
    regulator_role_rows        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    summary_updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (gene_key),
    INDEX idx_gene_summary_symbol (gene_symbol),
    INDEX idx_gene_summary_ensg (ensg_id),
    INDEX idx_gene_summary_traits (total_traits, total_programs, total_rows),
    INDEX idx_gene_summary_programs (total_programs, total_traits),
    INDEX idx_gene_summary_location (chromosome, begin_pos, end_pos),
    INDEX idx_gene_summary_type (gene_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
