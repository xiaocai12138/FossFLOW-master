package com.fossflow.backend.observability.entity;

import java.io.Serializable;
import java.util.Objects;

/** ObsTagBinding 的复合主键 */
public class ObsTagBindingKey implements Serializable {

    private static final long serialVersionUID = 1L;

    private String source;
    private String externalId;

    public ObsTagBindingKey() {
        // JPA
    }

    public ObsTagBindingKey(String source, String externalId) {
        this.source = source;
        this.externalId = externalId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }

        if (!(other instanceof ObsTagBindingKey key)) {
            return false;
        }

        return Objects.equals(source, key.source)
                && Objects.equals(externalId, key.externalId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(source, externalId);
    }
}
