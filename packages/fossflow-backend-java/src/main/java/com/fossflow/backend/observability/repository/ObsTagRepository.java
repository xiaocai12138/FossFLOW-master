package com.fossflow.backend.observability.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fossflow.backend.observability.entity.ObsTag;

public interface ObsTagRepository extends JpaRepository<ObsTag, String> {

    List<ObsTag> findByEnv(String env);

    List<ObsTag> findByParentTagId(String parentTagId);
}
