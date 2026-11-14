package com.fossflow.backend.observability.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fossflow.backend.observability.entity.ObsMeta;

public interface ObsMetaRepository extends JpaRepository<ObsMeta, String> {
}
