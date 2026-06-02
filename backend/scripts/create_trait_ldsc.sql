CREATE TABLE IF NOT EXISTS trait_ldsc (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gwas_id             VARCHAR(100) NOT NULL,
    file_id             VARCHAR(100) DEFAULT NULL,
    lof_id              VARCHAR(200) DEFAULT NULL,
    source_file         VARCHAR(255) DEFAULT NULL,
    enrichment          DOUBLE       DEFAULT NULL,
    coefficient_z_score DOUBLE       DEFAULT NULL,
    imported_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_trait_ldsc_gwas (gwas_id),
    INDEX idx_trait_ldsc_file (file_id),
    INDEX idx_trait_ldsc_lof (lof_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
