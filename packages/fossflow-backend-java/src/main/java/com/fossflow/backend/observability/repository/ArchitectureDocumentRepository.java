package com.fossflow.backend.observability.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fossflow.backend.observability.entity.ArchitectureDocument;

/** 后台架构文档仓库：列表按最近更新时间倒序，便于前端展示最近编辑的架构 */
public interface ArchitectureDocumentRepository
        extends JpaRepository<ArchitectureDocument, String> {

    List<ArchitectureDocument> findAllByOrderByUpdatedAtDesc();
}
