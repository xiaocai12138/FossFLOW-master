package com.fossflow.backend.observability.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fossflow.backend.observability.entity.ObsEdge;
import com.fossflow.backend.observability.entity.ObsEdgeKey;

public interface ObsEdgeRepository extends JpaRepository<ObsEdge, ObsEdgeKey> {

    List<ObsEdge> findByEnv(String env);

    List<ObsEdge> findByFromTag(String fromTag);

    List<ObsEdge> findByToTag(String toTag);
}
