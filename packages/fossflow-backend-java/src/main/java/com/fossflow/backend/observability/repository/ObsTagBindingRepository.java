package com.fossflow.backend.observability.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fossflow.backend.observability.entity.ObsTagBinding;
import com.fossflow.backend.observability.entity.ObsTagBindingKey;

public interface ObsTagBindingRepository
        extends JpaRepository<ObsTagBinding, ObsTagBindingKey> {

    Optional<ObsTagBinding> findBySourceAndExternalId(String source, String externalId);

    List<ObsTagBinding> findByTagId(String tagId);
}
